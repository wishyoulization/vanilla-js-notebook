import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Runtime } from '@observablehq/runtime';
import IridiumIconButton from './IridiumIconButton.js';
import IridiumCell from './IridiumCell.js';

const IridiumNotebook = (props) => {
  const ref = useRef(null);
  const [runtime, _runtime] = useState(new Runtime());
  const [main, _main] = useState(runtime.module());
  const [cells, _cells] = useState(props.cells);
  const [id, _id] = useState(
    Math.max.apply(
      Math,
      [0, ...props.cells].map((d) => d.id || 0),
    ) + 1,
  );

  const _onDelete = (r_id) => {
    _cells(cells.filter((d) => d.id !== r_id));
  };
  const _onPinToggle = (r_id) => {
    _cells(
      cells.map((d) => {
        if (d.id == r_id) {
          d.pin = !d.pin;
        }
        return d;
      }),
    );
  };
  const _onNew = () => {
    _id(id + 1);
    return _cells([...cells, { id: id + 1, pin: true, sourceCode: '' }]);
  };
  const _onNewBefore = (index) => {
    _id(id + 1);
    cells.splice(index, 0, {
      id: id + 1,
      pin: true,
      sourceCode: '',
    });
    return _cells(cells);
  };
  const _onUpdate = (r_id) => {
    return (sourceCode) =>
      _cells(
        cells.map((cell) =>
          cell.id === r_id ? Object.assign(cell, { sourceCode }) : cell,
        ),
      );
  };
  const onKeyPressForSave = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 's' || event.key === 'S')
    ) {
      //ctrl/cmd+s
      props.onSave(cells);
      event.preventDefault();
    }
  };

  useEffect(() => {
    main.define('runtime', [], () => runtime);
    main.define('main', [], () => main);
    
    main.define('width', ['Generators'], (Generators) => {
      var old_width = null;
      return Generators.observe((change) => {
        const ro = new ResizeObserver((entries) => {
          var new_width = 0;
          for (let entry of entries) {
            new_width = entry.contentRect.width - 28;
          }
          if (new_width != old_width) {
            change(new_width);
            old_width = new_width;
          }
        });
        ro.observe(ref.current);
        return () => ro.disconnect();
      });
    });

    // Store the main to top parent to use it for setting magic variables from outside the notebook
    props.onReady(main);
  }, []);

  useEffect(() => {
    props._cells(cells);
    document.addEventListener('keydown', onKeyPressForSave);
    return () => {
      document.removeEventListener('keydown', onKeyPressForSave);
    };
  }, [cells]);

  return html`<div class="IridiumNotebook" ref=${ref}>
    <div class="IridiumHeader">
      <div class="IridiumTitle">../${props.title || ''}</div>
      <${IridiumIconButton}
        content="Save"
        style="float:right;"
        onClick=${() => props.onSave(cells)}
        placement="left"
        name="journal-arrow-up"
      />
    </div>
    ${cells.map((cell, cell_index) => {
      return html`<${IridiumCell}
        key=${cell.id + ''}
        index=${cell_index + ''}
        main=${main}
        onDelete=${() => _onDelete(cell.id)}
        onPinToggle=${() => _onPinToggle(cell.id)}
        onUpdate=${_onUpdate(cell.id)}
        addBefore=${() => _onNewBefore(cell_index)}
        sourceCode=${cell.sourceCode}
        saveNotebook=${() => props.onSave(cells)}
        pinned=${cell.pin}
      />`;
    })}
    <div className="CellsAfter">
      <${IridiumIconButton}
        content="New"
        placement="right"
        name="plus-square"
        label="New"
        onClick=${() => _onNew()}
      />
    </div>
  </div>`;
};

export default IridiumNotebook;
