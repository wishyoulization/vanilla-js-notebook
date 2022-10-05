import { html } from 'htm/preact';
import icons from '../icons';

const IridiumIconButton = (props) => {
  return html`<img
    onClick=${props.onClick}
    src="${icons(props.name)}"
    title="${props.content || ''}"
    style="cursor:pointer;width:1rem;height:1rem;margin:4px;${props.style}"
  />`;
};

export default IridiumIconButton;
