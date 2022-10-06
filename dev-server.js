#!/usr/bin/env node

const rcfile = require('rcfile');
const Koa = require('koa');
const koaStatic = require('koa-static');
const cors = require('@koa/cors');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const fs = require('fs');
const acorn = require('acorn');

const app = new Koa();
const router = new Router();
const CONFIG = rcfile('vanilla', { configFileName: '.vanilla.json' });

const BASE = './';
const HEAD = CONFIG.head || ``;
const PORT = CONFIG.port || 8080;
const USECODEJAR = CONFIG.use_monaco == false;
const NOTEBOOKS = CONFIG.notebooks || `${BASE}`;
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
    <script src="${EDITOR_BASE}/${
  USECODEJAR ? 'iridium.js' : 'iridium-monaco.js'
}"></script>
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
    .filter((d) => d.match(/\.js$/))
    .map((d) => d.replace(/\.js$/, ''));
});

router.post('/read', async (ctx) => {
  const body = ctx.request.body;
  const notebook_url = body.path;
  const notebook_file_path = `${NOTEBOOKS}/${notebook_url || 'index'}.js`;

  await new Promise((yes, no) => {
    if (fs.existsSync(notebook_file_path)) {
      const notebook_content = fs.readFileSync(notebook_file_path, {
        encoding: 'utf8',
      });
      ctx.body = esm_to_cells(notebook_content);
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
    const notebook_file_path = `${NOTEBOOKS}/${notebook_url || 'index'}.js`;

    fs.writeFileSync(notebook_file_path, compile_to_esm(body.content));
    ctx.body = {};
  } catch (e) {
    ctx.status = 500;
    ctx.body = e;
  }
});

const compile_cell = (source) => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;
  const AsyncGeneratorFunction = Object.getPrototypeOf(
    async function* () {},
  ).constructor;
  try {
    const program = acorn.parse(source, {
      ecmaVersion: 11,
      sourceType: 'module',
    });
    if (
      program &&
      program.body &&
      program.body.length == 1 &&
      program.body[0].type == 'FunctionDeclaration'
    ) {
      //Good code!
    } else {
      throw 'Invalid Cell';
    }
    const func = program.body[0];
    const references = func.params.map((d) => d.name);
    const bodyText = source.substring(func.body.start, func.body.end);

    let code;
    if (func.body.type !== 'BlockStatement') {
      if (func.async)
        code = `return (async function(){ return (${bodyText});})()`;
      else code = `return (function(){ return (${bodyText});})()`;
    } else code = bodyText;

    let f;
    if (func.generator && func.async)
      f = new AsyncGeneratorFunction(...references, code);
    else if (func.async) f = new AsyncFunction(...references, code);
    else if (func.generator) f = new GeneratorFunction(...references, code);
    else f = new Function(...references, code);
    return {
      name: func.id.name,
      dependencies: references,
      function: f,
      source: source.substring(func.start, func.end),
    };
  } catch (e) {
    throw `Invalid Syntax; Cell can't be saved, expecting: FunctionDeclaration \neg: function CELL_NAME(DEPS,BUILTINS){return "VALUE";} `;
  }
};

const compile_to_esm = (cells) => {
  const processed = cells
    .map((raw_cell) => {
      try {
        return { raw: raw_cell, cell: compile_cell(raw_cell.sourceCode) };
      } catch (e) {
        return false;
      }
    })
    .filter((d) => d !== false);

  return `${processed
    .map(({ raw, cell }, i) => {
      const anonymous_cell = cell.name === '_';
      if (anonymous_cell) {
        return `const _${i} = ${cell.source};\n`;
      } else {
        return `export ${cell.source}\n`;
      }
    })
    .join('\n')}
export default function define(runtime, observer) {
  const main = runtime.module();
${processed
  .map(({ raw, cell }, i) => {
    const anonymous_cell = cell.name === '_';
    const dep_str = JSON.stringify(cell.dependencies);
    const name_str = JSON.stringify(cell.name);
    if (anonymous_cell) {
      return `  main.variable(observer()).define(${dep_str}, _${i});`;
    } else {
      return `  main.variable(observer(${name_str})).define(${name_str}, ${dep_str}, ${cell.name});`;
    }
  })
  .join('\n')}  
  return main;
}

//${JSON.stringify({
    pins: processed
      .map(({ raw, cell }, i) => {
        if (raw.pin) {
          return i;
        } else {
          return null;
        }
      })
      .filter((d) => d !== null),
  })}
`;
};

const esm_to_cells = (txt) => {
  let out = [];
  let pins = {};
  let parsed = acorn.parse(txt, {
    ecmaVersion: 11,
    sourceType: 'module',
    onComment: (block, text, start, end) => {
      try {
        pins = {};
        var tmp = JSON.parse(text);
        tmp.pins.map((d) => (pins[d] = true));
      } catch (e) {}
    },
  });

  parsed.body.map((d, i) => {
    const pinned = typeof pins[i] === 'undefined' ? false : true;
    if (d.type == 'ExportNamedDeclaration') {
      var tmp = d.declaration;
      out.push({
        id: i,
        pin: pinned,
        sourceCode: txt.substring(tmp.start, tmp.end),
      });
    } else if (d.type == 'VariableDeclaration') {
      var tmp = d.declarations[0].init;
      out.push({
        id: i,
        pin: pinned,
        sourceCode: txt.substring(tmp.start, tmp.end),
      });
    }
  });

  return out;
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


app.use(cors());
app.use(router.routes());
app.use(koaStatic(`${NOTEBOOKS}`, { maxage: 0 }));
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
