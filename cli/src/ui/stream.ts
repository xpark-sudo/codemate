import chalk from "chalk";

interface References {
  file: string;
  line: number;
  symbol: string | null;
}

/**
 * Render SSE events from the Agent loop to the terminal.
 */
export class StreamRenderer {
  private shownReferences = false;

  handle(event: string, data: any): void {
    switch (event) {
      case "plan":
        this.onPlan(data);
        break;
      case "search":
        this.onSearch(data);
        break;
      case "reflect":
        this.onReflect(data);
        break;
      case "answer":
        this.onAnswer(data);
        break;
      case "done":
        this.onDone(data);
        break;
      case "error":
        console.log(chalk.red(`\n  Error: ${data.message}`));
        break;
    }
  }

  reset(): void {
    this.shownReferences = false;
  }

  private onPlan(data: any): void {
    const iter = data.iteration || 1;
    console.log(
      chalk.blue(`\n${"▸".repeat(iter)} Plan [round ${iter}]`) +
        chalk.dim(` — ${data.reasoning || ""}`)
    );
    if (data.queries) {
      for (const q of data.queries) {
        console.log(chalk.dim(`    query: "${q}"`));
      }
    }
  }

  private onSearch(data: any): void {
    const count = data.results_count || 0;
    const files = (data.files || []).join(", ");
    console.log(
      chalk.yellow(`  🔍 Search`) +
        chalk.dim(` → ${count} results`) +
        (files ? chalk.dim(` (${files})`) : "")
    );
  }

  private onReflect(data: any): void {
    const icon = data.sufficient ? chalk.green("✓ Sufficient") : chalk.red("✗ Need more");
    console.log(`  ${icon}` + (data.missing ? chalk.dim(` — ${data.missing}`) : ""));
  }

  private onAnswer(data: any): void {
    if (!this.shownReferences) {
      this.shownReferences = true;
      console.log(chalk.green("\n── Answer ──\n"));
      if (data.references) {
        const files = [
          ...new Set(data.references.map((r: References) => r.file)),
        ];
        console.log(chalk.dim(`  Source: ${files.join(", ")}\n`));
      }
    }
    process.stdout.write(data.delta || "");
  }

  private onDone(data: any): void {
    const iters = data.iterations || 1;
    const chunks = data.chunks_found || 0;
    console.log(
      chalk.dim(`\n\n── ${iters} round(s), ${chunks} chunks ──`)
    );
  }
}
