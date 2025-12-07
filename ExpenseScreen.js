import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

import { BarChart } from "react-native-chart-kit";
import { useSQLiteContext } from 'expo-sqlite';


// Filters
const FILTERS = {
  ALL: 'ALL',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
};

// Store date as YYYY-MM-DD
function formatDateForDb(date) {
  return date.toISOString().slice(0, 10);
}

function isInCurrentWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;

  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return d >= monday && d <= sunday;
}

function isInCurrentMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [editingId, setEditingId] = useState(null);

  const loadExpenses = async () => {
    const rows = await db.getAllAsync("SELECT * FROM expenses ORDER BY id DESC");
    setExpenses(rows);
  };

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);
      await loadExpenses();
    }
    setup();
  }, []);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!category.trim()) return;

    const finalDate = date.trim() || formatDateForDb(new Date());

    if (!editingId) {
      await db.runAsync(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [amountNum, category, note, finalDate]
      );
    } else {
      await db.runAsync(
        "UPDATE expenses SET amount=?, category=?, note=?, date=? WHERE id=?",
        [amountNum, category, note, finalDate, editingId]
      );
    }

    resetForm();
    loadExpenses();
  };

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setNote(expense.note || "");
    setDate(expense.date || "");
  };

  const deleteExpense = async (id) => {
    await db.runAsync("DELETE FROM expenses WHERE id=?", [id]);
    loadExpenses();
  };

  const filteredExpenses = useMemo(() => {
    switch (filter) {
      case FILTERS.WEEK:
        return expenses.filter((e) => isInCurrentWeek(e.date));
      case FILTERS.MONTH:
        return expenses.filter((e) => isInCurrentMonth(e.date));
      default:
        return expenses;
    }
  }, [expenses, filter]);

  const totalsByCategory = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + Number(e.amount);
    });
    return map;
  }, [filteredExpenses]);

  const totalSpending = Object.values(totalsByCategory).reduce(
    (sum, n) => sum + n,
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      <View style={styles.filterRow}>
        <Button title="All" onPress={() => setFilter(FILTERS.ALL)} />
        <Button title="This Week" onPress={() => setFilter(FILTERS.WEEK)} />
        <Button title="This Month" onPress={() => setFilter(FILTERS.MONTH)} />
      </View>

      <View style={styles.totalsBox}>
        <Text style={styles.totalText}>Total: ${totalSpending.toFixed(2)}</Text>

        {Object.entries(totalsByCategory).map(([cat, amt]) => (
          <Text key={cat} style={styles.categoryTotal}>
            {cat}: ${amt.toFixed(2)}
          </Text>
        ))}
      </View>

      {Object.keys(totalsByCategory).length > 0 && (
        <BarChart
          data={{
            labels: Object.keys(totalsByCategory),
            datasets: [{ data: Object.values(totalsByCategory) }],
          }}
          width={Dimensions.get("window").width - 32}
          height={260}
          fromZero
          showValuesOnTopOfBars
          chartConfig={{
            backgroundColor: "#1f2937",
            backgroundGradientFrom: "#1f2937",
            backgroundGradientTo: "#1f2937",
            decimalPlaces: 2,
            color: () => "#fbbf24",
            labelColor: () => "#ffffff",
          }}
          style={{ marginVertical: 12, borderRadius: 10 }}
        />
      )}

      <View style={styles.form}>
        <TextInput
          placeholder="Amount"
          placeholderTextColor="#aaa"
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          placeholder="Category"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          placeholder="Note"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={date}
          onChangeText={setDate}
        />
        <Button
          title={editingId ? "Save Changes" : "Add Expense"}
          onPress={handleSubmit}
        />
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.expenseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.amount}>${item.amount}</Text>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.date}>{item.date}</Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => startEditing(item)}>
              <Text style={styles.edit}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteExpense(item.id)}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

//
// STYLES
//
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#111827",
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalsBox: {
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  totalText: {
    color: "#fbbf24",
    fontSize: 20,
    fontWeight: "bold",
  },
  categoryTotal: { color: "#e5e7eb", marginTop: 4 },
  form: { marginVertical: 12 },
  input: {
    backgroundColor: "#1f2937",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 8,
  },
  expenseRow: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  amount: { color: "#fbbf24", fontSize: 18, fontWeight: "bold" },
  category: { color: "#e5e7eb" },
  date: { color: "#9ca3af", fontSize: 12 },
  note: { color: "#9ca3af" },
  edit: { color: "#93c5fd", fontSize: 20, marginLeft: 10 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 10 },
});
