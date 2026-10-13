const fs = require("node:fs");
const path = require("node:path");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const entries = [];
const seen = new Set();
for (const [directory, meta] of Object.entries(lock.packages)) {
  if (
    !directory ||
    meta.dev === true ||
    !fs.existsSync(path.join(directory, "package.json"))
  )
    continue;
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const names = fs
    .readdirSync(directory)
    .filter((name) => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name));
  const texts = names.flatMap((name) => {
    const file = path.join(directory, name);
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 200000)
      return [];
    return [`${name}\n${fs.readFileSync(file, "utf8")}`];
  });
  const repository =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license:
      typeof pkg.license === "string" ? pkg.license : "See package notices",
    repository: repository || "",
    text:
      texts.join("\n\n") ||
      `License: ${pkg.license || "Not declared in package manifest"}. Source: ${repository || pkg.homepage || pkg.name}. No license file was included in the installed package.`,
  });
}
entries.sort((a, b) => a.name.localeCompare(b.name));
fs.mkdirSync("src/features/settings", { recursive: true });
fs.writeFileSync(
  "src/features/settings/licenses.json",
  JSON.stringify(entries),
);
process.stdout.write(
  `Bundled notices for ${entries.length} production packages.\n`,
);
