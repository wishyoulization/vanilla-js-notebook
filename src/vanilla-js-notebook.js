import { parse } from 'acorn';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(
  async function* () {},
).constructor;

export default {
  cell_from_source: (source) => {
    const program = parse(source, {
      ecmaVersion: 11,
      sourceType: 'module',
    });
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
    };
  },
};
