/**
 * Cucumber.js profile configuration.
 *
 * Runs through Bun (`bunx cucumber-js`), which natively transpiles the
 * TypeScript step definitions on import — no ts-node/babel loader required.
 */
module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: ["features/step-definitions/**/*.ts"],
    format: ["summary", "progress-bar"],
    publishQuiet: true,
  },
};
