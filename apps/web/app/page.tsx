"use client";

import { useEffect, useState } from 'react';

interface Employee {
  id: number;
  name: string;
  department: string;
  title: string;
}

export default function HomePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [empRes, tokenRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/token'),
        ]);
        const empData = await empRes.json();
        const tokenData = await tokenRes.json();
        setEmployees(empData);
        setToken(tokenData.token);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Employee Dashboard</h1>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>QBO Token</h2>
        {loading ? (
          <p>Loading token...</p>
        ) : (
          <pre style={{ background: '#f9f9f9', padding: '1rem' }}>
            {token ?? 'No token available'}
          </pre>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Employees</h2>
        {loading ? (
          <p>Loading employees...</p>
        ) : employees.length === 0 ? (
          <p>No employees found.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '0.5rem' }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Name</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Department</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '0.5rem' }}>Title</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{emp.id}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{emp.name}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{emp.department}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{emp.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}