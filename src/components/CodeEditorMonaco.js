import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const CodeEditor = (props) => {
  const ref = useRef(null);
  const [code, _code] = useState(props.code);
  const [jar, _jar] = useState(null);

  useEffect(() => {
    if (ref && ref.current) {
      const m = window.monaco.editor.create(ref.current, {
        value: '',
        language: 'javascript',
        wordWrap: true,
        theme: 'iridiumtheme',
        automaticLayout: false,
        scrollBeyondLastLine: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
      });

      const update_height = () => {
        const contentHeight = Math.max(32, Math.min(m.getContentHeight(), 500));
        ref.current.style.height = `${contentHeight}px`;
        m.layout();
      };
      m.getModel().setValue(code);
      m.getModel().onDidChangeContent((event) => {
        _code(m.getValue());
        update_height();
      });
      update_height();

      props.set_code({
        setter: (c) => {
          _code(c);
          m && m.getModel().setValue(c);
        },
      });

      var old_width = null;
      var ro = new ResizeObserver((entries) => {
        var new_width = 0;
        for (let entry of entries) {
          new_width = entry.contentRect.width;
        }
        if (new_width != old_width) {
          m.layout();
          old_width = new_width;
        }
      });
      ro.observe(ref.current);

      _jar(m);
    }

    return () => {
      ro.disconnect();
      jar && jar.dispose();
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
