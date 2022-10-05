import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CodeJar } from 'codejar';

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);
import xml from 'highlight.js/lib/languages/xml';
hljs.registerLanguage('xml', xml);
import css from 'highlight.js/lib/languages/css';
hljs.registerLanguage('css', css);

const CodeEditor = (props) => {
  const ref = useRef(null);
  const [code, _code] = useState(props.code);
  const [jar, _jar] = useState(null);

  useEffect(() => {
    if (ref && ref.current) {
      const cj = CodeJar(
        ref.current,
        (editor) => {
          // highlight.js does not trim old tags,
          // let's do it by this hack.
          editor.textContent = editor.textContent;
          hljs.highlightElement(editor, { language: 'js' });
        },
        {
          tab: '\t',
          indentOn: /[(\[]$/,
          addClosing: false,
          spellcheck: false,
        },
      );

      cj.updateCode(code);
      cj.onUpdate((code) => {
        _code(code);
      });

      props.set_code({
        setter: (c) => {
          _code(c);
          cj && cj.updateCode(c);
        },
      });

      _jar(cj);
    }

    return () => {
      jar && jar.destroy();
    };
  }, []);

  useEffect(() => {
    if (props.onUpdate) {
      props.onUpdate(code);
    }
  }, [code]);

  return html`<div class="EditorWrapper" tabindex=${props.index + ''}>
    <div
      ref=${ref}
      class="CodeEditor editor language-js"
      onKeyDown=${props.onKeypress}
    ></div>
  </div> `;
};

export default CodeEditor;
