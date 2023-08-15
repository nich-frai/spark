import { pino, type Logger, type LoggerOptions } from "pino";
import { default as kleur } from "kleur";
import { prettyPrintJson } from "#utils/pretty_json";

export interface TLogger {
  name: string;

  child(name?: string): TLogger;

  debug(msg: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
}

export class PinoLogger implements TLogger {
  private static devOutput: boolean = false;

  private static lastOutputId? : string;

  static enableDevOutput() {
    PinoLogger.devOutput = true;
  }

  static disableDevOutput() {
    PinoLogger.devOutput = false;
  }

  private _pino: Logger = pino();

  name: string = "Logger";

  constructor(options?: TLoggerCreationOptions | false) {
    if (options !== false) {
      this._pino = pino({
        ...DefaultPinoLoggerOptions,
        ...options,
      });
      this.name = options?.name ?? "Logger";
    }
  }

  child(name?: string) {
    const newLogger = new PinoLogger(false);
    newLogger._pino = this._pino.child({});
    if (name != null) newLogger.name = name;
    return newLogger;
  }

  debug(msg: string, ...args: unknown[]): void {
    this._pino.debug(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      const outputID = this.name + "DEBUG"
      if(PinoLogger.lastOutputId === outputID) {
        this.dev(
          ` @ ${kleur.dim().gray(`[${this.displayTime()}]`)} -> ${kleur.reset(msg)}`,
          ...args
        );  
        return;
      }
      PinoLogger.lastOutputId = outputID;
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ${kleur
          .white()
          .bold("DEBUG")} ${kleur.reset().underline(this.name)} \n${msg}`,
        ...args
      );
    }
  }

  trace(msg: string, ...args: unknown[]): void {
    this._pino.trace(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ➡️ ${kleur
          .gray()
          .bold("TRACE")} ${kleur.reset().underline(this.name)} \n${msg}`,
        ...args
      );
    }
  }

  info(msg: string, ...args: unknown[]): void {
    this._pino.info(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ${kleur
          .white()
          .bold("INFO ")} ${kleur.reset().underline(this.name)} \n${msg}`,
        ...args
      );
    }
  }

  warn(msg: string, ...args: unknown[]): void {
    this._pino.warn(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ${kleur
          .yellow()
          .bold("WARN ")} ${kleur.reset().underline(this.name)} ⚠️ \n${msg}`,
        ...args
      );
    }
  }

  error(msg: string, ...args: unknown[]): void {
    this._pino.error(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ${kleur
          .white()
          .bold("ERROR")} ${kleur.reset().underline(this.name)} 🚨\n${msg}`,
        ...args
      );
    }
  }

  fatal(msg: string, ...args: unknown[]): void {
    this._pino.fatal(
      args[0] ?? {},
      `[${this.name}]${msg != null ? ` -> ${msg}` : ""}`,
      ...args
    );

    if (PinoLogger.devOutput) {
      this.dev(
        `${kleur.dim().gray(`[${this.displayTime()}]`)} ${kleur
          .white()
          .bold("FATAL")} ${kleur.reset().underline(this.name)} 💀\n${msg}`,
        ...args
      );
    }
  }

  dev(msg: string, ...objs: unknown[]) {
    if (PinoLogger.devOutput) {
      process.stdout.write(kleur.bold(msg) + "\n");
      objs.forEach((o, i) => {
        let out = prettyPrintJson(o);
        if (process.stdout.columns ?? 100 > inlineOutput(out).length) {
          process.stdout.write(
            (i === objs.length - 1 ? "└─ " : "├─ ") + inlineOutput(out)
          );
        } else {
          process.stdout.write(out);
        }
        process.stdout.write("\n");
      });
      process.stdout.write("\n");
    }
  }

  private displayTime() {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(
      2,
      "0"
    )}.${now.getMilliseconds().toString().padStart(3, "0")}`;
    return nowTime;
  }
}

function inlineOutput(out: string) {
  return out
    //.replace(/\n/gm, "")
    .replace(/\s+/gm, " ")
    .replace(/(\[|{)\s+/gm, "$1");
}

export type TLoggerCreationOptions = LoggerOptions & { name: string };

const DefaultPinoLoggerOptions: TLoggerCreationOptions = {
  name: "Logger",
  level: "info",
  transport: {
    targets: [
      {
        target: "pino/file",
        level: "warn",
        options: {
          destination: "app_error.log",
        },
      },
    ],
  },
};
