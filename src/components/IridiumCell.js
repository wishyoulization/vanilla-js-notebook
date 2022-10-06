import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Inspector } from '@observablehq/runtime';
import CodeEditor from './CodeEditor.js';
import parserBabel from 'prettier/parser-babel';
import prettier from 'prettier/standalone';
import IridiumIconButton from './IridiumIconButton.js';
import VanillaJSNotebook from '../vanilla-js-notebook.js';

const DEFAULT_CELL_TEXT = `function _() {
  // Add required builtins and dependencies as args
  // Name the cell by replacing _ with a new name

  return;
}`;

const get_cell_type = (og_source) => {
  const source = ('' + og_source).trimStart();
  if (source) {
    if (source.match(/^viewof /)) {
      return 'viewof';
    } else if (source.match(/^mutable /)) {
      return 'mutable';
    } else if (source.match(/^import /)) {
      return 'import';
    } else {
      return '';
    }
  } else {
    return '';
  }
};

const IridiumCell = (props) => {
  const ref = useRef(null);
  const [error, _error] = useState(null);
  const [sourceCode, _sourceCode] = useState(
    props.sourceCode || DEFAULT_CELL_TEXT,
  );
  const [savedSourceCode, _savedSourceCode] = useState(null);
  const [variables, _variables] = useState(null);
  const [setSource, _setSource] = useState(null);
  const unsaved = savedSourceCode !== sourceCode;
  const cell_type = get_cell_type(sourceCode);

  const _onDelete = () => {
    props.onDelete();
    if (variables) variables.map((v) => v.delete());
  };

  const _onSave = () => {
    _savedSourceCode(sourceCode);
    props.onUpdate(sourceCode);

    if (variables) {
      for (const v of variables) {
        v.delete();
        if (v._observer._node) {
          v._observer._node.remove();
        }
      }
    }
    const child = ref.current.appendChild(document.createElement('div'));
    const observer = (name) => {
      return new Inspector(child);
    };

    try {
      const cell = VanillaJSNotebook.cell_from_source(sourceCode);
      const anonymous_cell = cell.name === '_';
      const variable = anonymous_cell
        ? props.main
            .variable(observer())
            .define([], cell.dependencies, cell.function)
        : props.main
            .variable(observer(cell.name))
            .define(cell.name, cell.dependencies, cell.function);
      _error(null);
      _variables([variable]);
      if (cell.source !== sourceCode) {
        setSource && setSource.setter(cell.source);
      }
    } catch (e) {
      _error(e);
      console.warn(e);
    }
  };

  const _onTextAreaInput = (v) => {
    return _sourceCode(v);
  };

  const _onTextAreaKeypress = (event) => {
    // shift+enter
    if (event.keyCode === 13 && event.shiftKey) {
      event.preventDefault();
      _onSave();
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 's' || event.key === 'S')
    ) {
      //ctrl/cmd+s
      event.preventDefault();
      _onSave();
      props.saveNotebook();
    }
  };

  useEffect(() => {
    if (ref.current && sourceCode) {
      _onSave();
    }
  }, []);

  return html`<div
    class=${`IridiumCell ${props.pinned ? 'Pinned' : 'UnPinned'} ${
      unsaved ? 'IridiumCellUnsaved' : 'IridiumCellSaved'
    }`}
  >
    <div style=${`display: ${error ? 'block' : 'none'}`} class="CellError">
      <div class="observablehq observablehq--error">
        <div class="observablehq--inspect">${error + ''}</div>
      </div>
    </div>
    <div
      ref=${ref}
      class=${`CellResults ${cell_type}`}
      style=${`display: ${!error ? 'block' : 'none'}`}
    ></div>
    <div class="CellBefore">
      <${IridiumIconButton}
        name="plus-square"
        label="New"
        onClick=${props.addBefore}
      />
    </div>
    <div class="CellActions" onClick=${props.onPinToggle}>
      <${IridiumIconButton}
        content="Pin"
        placement="bottom"
        name=${props.pinned ? 'pin-angle-fill' : 'pin-angle'}
        label="pin"
      />
    </div>
    ${props.pinned
      ? html`<div class="CellContainer">
          <${CodeEditor}
            code=${sourceCode}
            index=${props.index}
            unsaved=${unsaved}
            onUpdate=${_onTextAreaInput}
            onKeypress=${_onTextAreaKeypress}
            set_code=${_setSource}
          />
          <div class="CellEditorActions">
            <${IridiumIconButton}
              content="Delete"
              name="trash2"
              label="Delete"
              onClick=${_onDelete}
            />
            <${IridiumIconButton}
              content="Indent"
              name="text-indent-left"
              label="Indent"
              style="font-size: 1.25rem;"
              onClick=${() => {
                var formatted = prettier.format(sourceCode, {
                  parser: 'babel',
                  plugins: [parserBabel],
                });
                setSource && setSource.setter(formatted.replace(/\n$/, ''));
              }}
            />
            <${IridiumIconButton}
              content="Run"
              name=${unsaved ? 'play-fill' : 'play'}
              label="Run"
              style="font-size: 1.25rem;"
              onClick=${_onSave}
            />
          </div>
        </div>`
      : null}
  </div>`;
};

export default IridiumCell;
