#!/usr/bin/env node

const rcfile = require('rcfile');
const Koa = require('koa');
const koaStatic = require('koa-static');
const cors = require('@koa/cors');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const fs = require('fs');
const yaml = require('js-yaml');

const app = new Koa();
const router = new Router();
const CONFIG = rcfile('vanilla', { configFileName: '.vanilla.json' });
const BASE = './';
const HEAD = CONFIG.head || ``;
const PORT = CONFIG.port || 8080;
const NOTEBOOKS = CONFIG.notebooks || `${BASE}`;
const COMPILED = CONFIG.compiled || `${BASE}`;
const EDITOR_BASE =
  CONFIG.local_editor === true
    ? '.'
    : 'https://unpkg.com/@wishyoulization/vanilla-js-notebook/dist';

const gen_viewer_markup = (url) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <link
      rel="stylesheet"
      data-name="vs/editor/editor.main"
      href="${EDITOR_BASE}/vs/editor/editor.main.css"
    />
    
    <script>
      var require = { paths: { vs: '${EDITOR_BASE}/vs' } };
    </script>
    <script src="${EDITOR_BASE}/iridium-monaco-theme.js"></script>
    <script src="${EDITOR_BASE}/vs/loader.js"></script>
    <script src="${EDITOR_BASE}/vs/editor/editor.main.nls.js"></script>
    <script src="${EDITOR_BASE}/vs/editor/editor.main.js"></script>
    <script src="${EDITOR_BASE}/vs/basic-languages/javascript/javascript.js"></script>
    <script type="module">
      monaco.editor.defineTheme('iridiumtheme', monaco_editor_theme);
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
    </script>
    <script src="${EDITOR_BASE}/iridium-monaco.js"></script>
    ${HEAD}
  </head>
  <body data-hint-view-only="IridiumViewOnly">
    <div id="iridium-root-wrapper">
      <div id="iridium-root"></div>
    </div>
    <script>
      // Override with custom load, save, new, delete, list promises.
      Iridium.load = () => {
        return new Promise((yes, no) => {
          fetch("/read", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              path: "${url}"
            }),
          }).then(d=>{
            if(!d.ok){
              throw new Error("Error");
            }
            return d.json()
          }).then(d=>{
            yes(d);
        }).catch(e=>{
            console.log(e);
            yes([])
          })
        });
      };
      Iridium.save = (name,data) => {
        return new Promise((yes, no) => {
          fetch("/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: data,
              path: "${url}"
            }),
          }).then(d=>{
            if(!d.ok){
              throw new Error("Error");
            }
            yes(true);
          }).catch(e=>{
          })
        });
      };
      Iridium.render(
        Iridium.html\`<\${Iridium.IridiumApp} Ir=\${Iridium} />\`,
        document.getElementById('iridium-root'),
      );
    </script>
    <style>
      .IridiumTitle:after {
        content: "${url}";
      }
    </style>
  </body>
</html>`;

app.use(bodyParser());

router.post('/list', async (ctx) => {
  ctx.body = fs
    .readdirSync(NOTEBOOKS)
    .filter((d) => d.match(/\.yaml$/))
    .map((d) => d.replace(/\.yaml$/, ''));
});

router.post('/read', async (ctx) => {
  const body = ctx.request.body;
  const notebook_url = body.path;
  const notebook_file_path = `${NOTEBOOKS}/${notebook_url || 'index'}.yaml`;

  await new Promise((yes, no) => {
    if (fs.existsSync(notebook_file_path)) {
      const notebook_content = fs.readFileSync(notebook_file_path, {
        encoding: 'utf8',
      });
      ctx.body = yaml.load(notebook_content);
      yes(true);
    } else {
      ctx.body = [
        {
          id: 0,
          pin: true,
          sourceCode: 'function _(md){\n\treturn md`# 404 - Not Found!`\n}',
        },
      ];
      yes(true);
    }
  });
});

router.post('/save', async (ctx) => {
  try {
    const body = ctx.request.body;
    const notebook_url = body.path;
    const notebook_file_path = `${NOTEBOOKS}/${notebook_url || 'index'}.yaml`;
    fs.writeFileSync(notebook_file_path, yaml.dump(body.content));
    ctx.body = {};
  } catch (e) {
    ctx.status = 500;
    ctx.body = e;
  }
});

const compile_all = () => {
  // const all = fs
  //   .readdirSync(NOTEBOOKS)
  //   .filter((d) => d.match(/\.json$/))
  //   .map((d) => d.replace(/\.json$/, ''));
  // all.map((notebook_url) => {
  //   try {
  //     console.log('Compiling', notebook_url);
  //     const notebook_file_path = `${NOTEBOOKS}/${notebook_url || 'index'}.json`;
  //     const compiled_file_path = `${COMPILED}/${notebook_url || 'index'}.js`;
  //     const ojs = fs.readFileSync(notebook_file_path, {
  //       encoding: 'utf8',
  //     });
  //     const js = source_to_esm(ojs);
  //     fs.writeFileSync(compiled_file_path, js);
  //   } catch (e) {
  //     console.log('Error compiling', notebook_url, e);
  //   }
  // });
};

const valid_url_only = (str) => {
  return (
    '/' +
    str
      .replace(/^\//, '')
      .replace(/\/.*$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
  );
};

app.use(async (ctx, next) => {
  try {
    //try static routes first
    if (ctx.url == '/') {
      throw 'index.html is not served from static folder to avoid conflict';
    }
    await next();
    const status = ctx.status || 404;
    if (status === 404) {
      ctx.throw(404);
    }
  } catch (err) {
    ctx.url = valid_url_only(ctx.url);
    ctx.type = 'html';
    const notebook_url = ctx.url.replace(/^\//, '') || 'index';
    ctx.body = gen_viewer_markup(notebook_url);
  }
});

if (process.argv.indexOf('-build') > -1) {
  compile_all();
} else {
  app.use(cors());
  app.use(router.routes());
  app.use(koaStatic(`${COMPILED}`, { maxage: 0 }));
  if (CONFIG.local_editor === true) {
    const editor_files = `./dist`;
    const editor_files_alternate = `${__dirname}/${editor_files}`;
    const longtime = 365 * 24 * 60 * 60 * 1000;
    if (fs.existsSync(editor_files)) {
      app.use(
        koaStatic(editor_files, {
          maxage: longtime,
        }),
      );
    } else if (fs.existsSync(editor_files_alternate)) {
      app.use(
        koaStatic(editor_files_alternate, {
          maxage: longtime,
        }),
      );
    }
  }
  app.listen(PORT);

  console.log(`\nDev Server Started On 'http://localhost:${PORT}'`);
}
