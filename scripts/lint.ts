const directories = ["src", "test", "scripts"];
const errors: string[] = [];

for (const directory of directories) {
  const root = Bun.fileURLToPath(new URL(`../${directory}/`, import.meta.url));

  for await (const file of new Bun.Glob("**/*.ts").scan(root)) {
    const path = `${root}${file}`;
    const content = await Bun.file(path).text();
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (/\t/.test(line)) {
        errors.push(`${directory}/${file}:${index + 1} contains a tab character`);
      }

      if (/[ \t]+$/.test(line)) {
        errors.push(`${directory}/${file}:${index + 1} contains trailing whitespace`);
      }
    });
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Lint checks passed.");

