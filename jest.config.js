module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: "./tsconfig.json",
    },
  },
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testMatch: ["**/+(*.)*(test).ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  name: "framework-node",
  displayName: "framework-node",
};
