import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet 
} from "react-native";
import * as SQLite from "expo-sqlite";
import ExpenseChart from "./components/charts/ExpenseChart";

// Open SQLite database
const db = SQLite.openDatabase("expenses.db");

export default function ExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [expenses, setExpenses] = useState([]);

  // Create table + load existing data
  useEffect(() => {
    async function setup() {
      db.transaction((tx) => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL,
            category TEXT NOT NULL,
            note TEXT,
            date TEXT NOT NULL
          );`
        );
      });

      loadExpenses();
    }

    setup();
  }, []);

  // Load all expenses
  const loadExpenses = () => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM expenses ORDER BY id DESC",
        [],
        (_, { rows }) => {
          setExpenses(rows._array);
        }
      );
    });
  };

  // Save expense into DB
  const saveExpense = () => {
    if (!amount || !category || !date) return;

    db.transaction((tx) => {
      tx.executeSql(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [parseFloat(amount), category, note, date]
      );
    });

    setAmount("");
    setCategory("");
    setNote("");
    setDate("");
    loadExpenses();
  };

  // Delete expense
  const deleteExpense = (id) => {
    db.transaction((tx) => {
      tx.executeSql("DELETE FROM expenses WHERE id = ?", [id]);
    });
    loadExpenses();
  };

  // -------------------------------
  // 📊 CHART TRANSFORMATION FUNCTION
  // -------------------------------
  const transformExpensesForChart = (expenses) => {
    const totals = {};

    expenses.forEach((item) => {
      const category = item.category;
      totals[category] = (totals[category] || 0) + item.amount;
    });

    return {
      labels: Object.keys(totals),
      values: Object.values(totals),
    };
  };

  // Chart data (computed from expenses)
  const chartData = transformExpensesForChart(expenses);

  return (
    <ScrollView style={{ padding: 20 }}>
      
      {/* 🔵 CHART AT TOP */}
      {expenses.length > 0 && (
        <ExpenseChart data={chartData} />
      )}

      <Text style={styles.header}>Add Expense</Text>

      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        keyboardType="numeric"
        style={styles.input}
      />

      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="Category"
        style={styles.input}
      />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        style={styles.input}
      />

      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="Date (YYYY-MM-DD)"
        style={styles.input}
      />

      <Button title="Save Expense" onPress={saveExpense} color="#4CAF50" />

      <Text style={styles.header}>Expenses</Text>

      {expenses.map((item) => (
        <View key={item.id} style={styles.expenseRow}>
          <Text style={styles.amount}>${item.amount}</Text>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.date}>{item.date}</Text>
          <Text style={styles.note}>{item.note}</Text>

          <TouchableOpacity onPress={() => deleteExpense(item.id)}>
            <Text style={styles.delete}>✖</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 10,
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
  },
  expenseRow: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  amount: { color: "#fbbe24", fontSize: 18, fontWeight: "bold", marginRight: 10 },
  category: { color: "#5e7eeb", marginRight: 10 },
  date: { color: "#9ca3af", marginRight: 10 },
  note: { color: "#9ca3af", flex: 1 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 10 },
});
