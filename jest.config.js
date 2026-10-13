module.exports = {
  preset: "jest-expo",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
    "^.+\\.sql$": "<rootDir>/scripts/sql-transformer.js",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/lib/daily-log.ts",
    "src/lib/subjects.ts",
    "src/features/subjects/content-model.ts",
    "src/features/timetable/import/parser.ts",
    "src/features/timetable/import/preview.ts",
    "src/features/onboarding/model.ts",
    "src/lib/attendance/**/*.ts",
    "!src/lib/attendance/index.ts",
  ],
  coverageThreshold: {
    "./src/lib/attendance/": {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
