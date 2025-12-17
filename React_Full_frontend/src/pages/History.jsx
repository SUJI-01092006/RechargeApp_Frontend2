import React, { useEffect, useMemo, useState } from "react";

export default function History() {
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("currentUser") || "null"),
    []
  );

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser || !currentUser.id) {
        setLoading(false);
        return;
      }

      const fallbackFromLocal = () => {
        if (!currentUser?.email) return [];
        const key = `rechargeHistory_${currentUser.email}`;
        try {
          return JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
          return [];
        }
      };

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          // No token → fall back to localStorage history only
          setHistory(fallbackFromLocal());
          setLoading(false);
          return;
        }

        const response = await fetch(
          `http://localhost:5000/api/recharge/history/${currentUser.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        let result = {};
        try {
          result = await response.json();
        } catch {
          result = {};
        }

        if (response.ok && result.success && Array.isArray(result.history)) {
          setHistory(result.history);
        } else {
          console.error("Failed to fetch history from API, using local copy");
          setHistory(fallbackFromLocal());
        }
      } catch (error) {
        console.error("Error fetching history, using local copy:", error);
        setHistory(fallbackFromLocal());
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [currentUser]);

  const formatDate = (value) => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  return (
    <div className="history-page">
      <h2 className="history-title">Recharge History</h2>

      {!currentUser && (
        <p className="history-empty">
          Please login to see your recharge history.
        </p>
      )}

      {currentUser && loading && (
        <p className="history-empty">Loading your recharge history...</p>
      )}

      {currentUser && !loading && history.length === 0 && (
        <p className="history-empty">
          You have not done any recharges yet. Your history will appear here
          after your first recharge.
        </p>
      )}

      {currentUser && !loading && history.length > 0 && (
        <div className="history-list">
          {history.map((item, index) => {
            // Support both MongoDB records and localStorage records
            const key = item._id || index;
            const amount = item.amount ?? item.price;
            const operator = item.operator || "Airtel";
            const validity = item.Validity || item.validity;
            const data = item.data;
            const call = item.call;

            return (
              <div key={key} className="history-card">
                <div className="history-plan">
                  <h3>₹{amount}</h3>
                  {(validity || data) && (
                    <p>
                      {validity} {validity && data ? " • " : ""}
                      {data}
                    </p>
                  )}
                  {call && <p>{call}</p>}
                  <p>{operator}</p>
                </div>

                <div className="history-date">
                  <p>
                    <strong>Date:</strong>{" "}
                    {formatDate(item.date || item.createdAt)}
                  </p>
                  <p>
                    <strong>Status:</strong> {item.status || "SUCCESS"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
