import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';

export default function App() {
  return (
    <SQLiteProvider databaseName="expenses.db">
      <main />
    </SQLiteProvider>
  );
}
