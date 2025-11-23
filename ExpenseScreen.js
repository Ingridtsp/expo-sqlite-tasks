// ExpenseScreen.js
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
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

const FILTERS = {
  ALL: 'ALL',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
};

// Store date as "YYYY-MM-DD"
function formatDateForDb(date) {
  return date.toISOString().slice(0, 10);
}

function isInCurrentWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  // Make Monday the start of the week
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
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
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  );
}

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);

  // Form fields (used for both add + edit)
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(''); // "YYYY-MM-DD" or empty = use today

  // Filter state
  const [filter, setFilter] = useState(FILTERS.ALL);

  // Editing state (null means "add mode")
  const [editingId, setEditingId] = useState(null);

  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY id DESC;'
    );
    setExpenses(rows);
  };

  // Create table WITH date column
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
  }, [db]);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      // basic validation
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();
    if (!trimmedCategory) {
      return;
    }

    const expenseDate = date.trim() || formatDateForDb(new Date());

    if (editingId == null) {
      // ADD (INSERT)
      await db.runAsync(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [amountNumber, trimmedCategory, trimmedNote || null, expenseDate]
      );
    } else {
      // EDIT (UPDATE)
      await db.runAsync(
        'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?;',
        [amountNumber, trimmedCategory, trimmedNote || null, expenseDate, editingId]
      );
    }

    resetForm();
    await loadExpenses();
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    await loadExpenses();
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setAmount(String(item.amount));
    setCategory(item.category);
    setNote(item.note || '');
    setDate(item.date || '');
  };

  // === Filtering ===
  const filteredExpenses = useMemo(() => {
    if (filter === FILTERS.ALL) return expenses;

    if (filter === FILTERS.WEEK) {
      return expenses.filter((e) => isInCurrentWeek(e.date));
    }

    if (filter === FILTERS.MONTH) {
      return expenses.filter((e) => isInCurrentMonth(e.date));
    }

    return expenses;
  }, [expenses, filter]);

  // === Totals ===
  const totalSpending = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );
  }, [filteredExpenses]);

  const totalsByCategory = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'Uncategorized';
      const amt = Number(e.amount || 0);
      map[cat] = (map[cat] || 0) + amt;
    });
    return map;
  }, [filteredExpenses]);

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>
          ${Number(item.amount).toFixed(2)}
        </Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.date ? (
          <Text style={styles.expenseDate}>{item.date}</Text>
        ) : null}
        {item.note ? (
          <Text style={styles.expenseNote}>{item.note}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* Filter buttons */}
      <View style={styles.filterRow}>
        <Button
          title="All"
          onPress={() => setFilter(FILTERS.ALL)}
          color={filter === FILTERS.ALL ? '#fbbf24' : undefined}
        />
        <Button
          title="This Week"
          onPress={() => setFilter(FILTERS.WEEK)}
          color={filter === FILTERS.WEEK ? '#fbbf24' : undefined}
        />
        <Button
          title="This Month"
          onPress={() => setFilter(FILTERS.MONTH)}
          color={filter === FILTERS.MONTH ? '#fbbf24' : undefined}
        />
      </View>

      {/* Totals */}
      <View style={styles.totalsBox}>
        <Text style={styles.totalsTitle}>
          Total Spending (
          {filter === FILTERS.ALL
            ? 'All'
            : filter === FILTERS.WEEK
            ? 'This Week'
            : 'This Month'}
          )
        </Text>
        <Text style={styles.totalsAmount}>
          ${totalSpending.toFixed(2)}
        </Text>

        <Text style={styles.totalsSubtitle}>By Category</Text>
        {Object.keys(totalsByCategory).length === 0 ? (
          <Text style={styles.emptyTotals}>No expenses for this filter.</Text>
        ) : (
          Object.entries(totalsByCategory).map(([cat, amt]) => (
            <Text key={cat} style={styles.totalsCategoryRow}>
              {cat}: ${amt.toFixed(2)}
            </Text>
          ))
        )}
      </View>

      {/* Add / Edit form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (e.g. Food, Rent)"
          placeholderTextColor="#6b7280"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#6b7280"
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          style={styles.input}
          placeholder='Date (YYYY-MM-DD) – leave empty for today'
          placeholderTextColor="#6b7280"
          value={date}
          onChangeText={setDate}
        />

        <Button
          title={editingId == null ? 'Add Expense' : 'Save Changes'}
          onPress={handleSubmit}
        />

        {editingId != null && (
          <View style={{ marginTop: 8 }}>
            <Button title="Cancel Edit" color="#6b7280" onPress={resetForm} />
          </View>
        )}
      </View>

      {/* Expense list */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No expenses yet. Enter your expenses and they’ll be saved locally
            with SQLite.
          </Text>
        }
        style={{ flex: 1, marginTop: 8 }}
      />

      <Text style={styles.footer}>
        Data is stored locally on this device using SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#111827',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  totalsBox: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  totalsTitle: {
    color: '#e5e7eb',
    fontWeight: '600',
    marginBottom: 4,
  },
  totalsAmount: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  totalsSubtitle: {
    color: '#9ca3af',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  totalsCategoryRow: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  emptyTotals: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  form: {
    marginBottom: 12,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  edit: {
    color: '#a5b4fc',
    fontSize: 20,
    marginLeft: 8,
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 8,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 8,
    fontSize: 12,
  },
});
