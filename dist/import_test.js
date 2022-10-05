export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer('cell1')).define('cell1', function () {
    return 22;
  });

  main.variable(observer('cell2')).define('cell2', function () {
    return 38;
  });

  main
    .variable(observer('calc'))
    .define('calc', ['cell1', 'cell2'], function (cell1, cell2) {
      return cell1 + cell2;
    });
  return main;
}
