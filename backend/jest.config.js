module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Ścieżka do katalogów z testami
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  // Ustawienie, które pliki ma testować (np. całe src/)
  collectCoverageFrom: ["src/**/*.ts"], 
  moduleNameMapper: {
    // Zapewnienie, że ścieżki względne są mapowane poprawnie
    "^@interfaces/(.*)$": "<rootDir>/src/interfaces/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@controllers/(.*)$": "<rootDir>/src/controllers/$1",
    "^@loaders/(.*)$": "<rootDir>/src/loaders/$1"
    // Dodaj inne aliasy, których używasz
  }
};