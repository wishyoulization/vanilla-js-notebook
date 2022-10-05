import { html, render } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import IridiumNotebook from './components/IridiumNotebook';

import './editor.scss';
import './inspector.scss';


const IridiumApp = (props) => {
  const [current, _current] = useState(props.Ir.get_recent() || null);
  const [cells, _cells] = useState(null);
  const [og_cells, _og_cells] = useState(null);
  const [list, _list] = useState([]);

  useEffect(() => {
    props.Ir.set_recent(current);
    props.Ir.load(current).then((loaded) => {
      if (loaded) {
        _cells(loaded);
        _og_cells(JSON.stringify(loaded));
      } else {
        _cells([]);
        _og_cells(JSON.stringify([]));
      }
    });
  }, [current]);

  useEffect(() => {
    refreshList();
  }, []);

  const refreshList = () => {
    props.Ir.list().then((all) => {
      if (all.length == 0) {
      } else {
        _list(all);
      }
    });
  };

  const onSave = (cells) => {
    props.Ir.save(current, cells).then((done) => {
      _og_cells(JSON.stringify(cells));
    });
  };

  const onReady = (main) => {
    props.Ir.ready(main);
  };

  const notebook_unchanged =
    JSON.stringify((cells || []).map((d) => d.sourceCode)) ===
    JSON.stringify(JSON.parse(og_cells || '[]').map((d) => d.sourceCode));

  return html`<div
    class="IridiumApp ${notebook_unchanged
      ? 'IridiumNotebookSaved'
      : 'IridiumNotebookUnsaved'}"
  >
    ${cells
      ? html`<${IridiumNotebook}
          title=${current}
          cells=${cells}
          onSave=${onSave}
          onReady=${onReady}
          doRefresh=${refreshList}
          list=${list}
          _current=${_current}
          _cells=${_cells}
        />`
      : null}
  </div>`;
};

window.Iridium = {
  IridiumApp: IridiumApp,
  html: html,
  render: render,
  useEffect: useEffect,
  useRef: useRef,
  useState: useState,
  save: (name, cells) => {
    return new Promise((yes, no) => {
      yes(localStorage.setItem(name + '', JSON.stringify(cells)));
    });
  },
  new: (name) => {
    return new Promise((yes, no) => {
      yes(localStorage.setItem(name + '', JSON.stringify([])));
    });
  },
  load: (name) => {
    return new Promise((yes, no) => {
      yes(JSON.parse(localStorage.getItem(name + '')));
    });
  },
  list: () => {
    return new Promise((yes, no) => {
      yes(Object.keys(localStorage));
    });
  },
  delete: (name) => {
    localStorage.removeItem(name);
  },
  get_recent: () => {
    return localStorage.getItem('IridiumRecent');
  },
  set_recent: (name) => {
    if (name) {
      return localStorage.setItem('IridiumRecent', name);
    } else {
      return false;
    }
  },
  ready: (main) => {
    window.IridiumMain = main;
  },
};

// render(
//   html`<${IridiumApp} Ir=${Iridium} />`,
//   document.getElementById('iridium-root'),
// );
