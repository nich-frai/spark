import { default as kleur } from 'kleur';

export function prettyPrintJson(value: any, depth = 0, inline = false) {
    let outBuffer: string = '';
  
    const print = (str: string) => {
      outBuffer += str;
      return outBuffer;
    };
  
    if (depth > 10) {
      return outBuffer;
    }
  
  
    const str = kleur.green;
    const sym = kleur.yellow;
    const num = kleur.magenta;
    const date = (d: Date) => {
      return print(
        kleur!.bold().red("Date(")
        + kleur!.white('"' + d.toString() + '"')
        + kleur!.bold().red(")")
      );
    };
  
    // TODO: colorize functions, arrays, classes and so on
    const arr = (arr: unknown[]) => {
      const jumpWhen = 5;
      print(kleur!.yellow('[ '));
      const multilinePrint = arr.length >= jumpWhen;
      multilinePrint && print('\n');
  
      arr.forEach((v, i) => {
        const shouldJump = i % jumpWhen === jumpWhen - 1;
        const justJumped = i % jumpWhen === 0;
  
        multilinePrint && justJumped && print(" ".repeat((1 + depth) * 2));
        print(prettyPrintJson(v, depth + 1, true));
        print(', ');
        multilinePrint && shouldJump && print("\n");
      });
      multilinePrint && print('\n' + " ".repeat(depth * 2))
      return print(kleur!.yellow(']'));
    };
  
    const obj = (obj: Record<string | number | symbol, unknown>, depth = 0) => {
      print(kleur!.blue('{ '));
      inline || print('\n');
  
      // print regular keys
      Object.entries(obj).forEach(([k, v]) => {
        // print tab
        inline || print(" ".repeat(2 * (depth + 1)));
        // print key
        print(typeof k === 'number' ? `${kleur!.bold(k)}: ` : `"${k}": `);
        // print value
        print(prettyPrintJson(v, depth + 1, inline));
        print(', ');
        // jump a line
        inline || print('\n');
      });
  
      // print symbol keys
      Object.getOwnPropertySymbols(obj).forEach(s => {
        const v = obj[s];
        // print tab
        inline || print(" ".repeat(2 * (depth + 1)));
        // print key
        print(`[${sym(s.description ?? "SymbolDescription")}(symbol)]: `);
        // print value
        print(prettyPrintJson(v, depth + 1, inline));
        // jump a line
        print(',\n');
      });
      // print tab
      inline || print(" ".repeat(2 * depth));
      return print(kleur!.blue('}'));
    }
  
    // TODO: pretty print function signature
    const fun = (str: string) => {
      return print(str + '\n');
    };
  
    // TODO: detect and pretty print class signatures
    const clas = (str: string) => {
    };
  
    if (typeof value === 'string') {
      if (depth === 0) return print(value);
      return print('"' + str(value) + '"');
    }
  
    if (typeof value === 'number') {
      return print(num(value));
    }
  
    if (value === undefined) {
      return print(num("undefined"));
    }
  
    if (value === null) {
      return print(num("undefined"));
    }
  
    if (typeof value === 'object') {
      // is array?
      if (Array.isArray(value)) {
        return arr(value);
      }
  
      // is date°
      if (value instanceof Date) {
        return date(value)
      }
  
      return obj(value, depth);
    }
  
    if (typeof value === 'function') {
      return fun(value.toString());
    }
  
    if (typeof value === 'boolean') {
      return print(kleur!.cyan(value ? 'true' : 'false'));
    }
  
    if (typeof value === 'symbol') {
      return print(`[${sym(value.description ?? "SymbolDescription")}(symbol)]`);
    }
  
    return outBuffer;
  
  }
  