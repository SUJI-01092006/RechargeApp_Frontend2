import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Tabs you want
const FIXED_TABS = [
  "RECOMMENDED",
  "TRULY UNLIMITED",
  "SMART RECHARGE",
  "DATA",
  "UNLIMITED 5G"
];

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [activeTab, setActiveTab] = useState("RECOMMENDED");

  const navigate = useNavigate();

  // Load plans from your own backend API (MongoDB)
  useEffect(() => {
    axios
      .get("https://rechargeapp-backend.onrender.com/api/plans")
      .then((res) => {
        // Backend returns: { success: true, plans: [...] }
        setPlans(res.data?.plans || []);
      })
      .catch(() => setPlans([]));
  }, []);

  // Normalize for matching text
  function normalize(str) {
    if (!str) return "";
    return str.toString().trim().toUpperCase().replace(/\s+/g, " ");
  }

  // Decide which tab/category a plan belongs to based on its details
    // Decide which tab/category a plan belongs to based on its details
  function getCategoryForPlan(p) {
    // PRIORITY 1: If backend set an explicit type/category, use that FIRST
    if (p.type || p.Type) {
      const explicitType = (p.type || p.Type).toString().trim().toUpperCase();
      // Direct match with our tab names
      const normalizedType = normalize(explicitType);
      
      // Check if it matches any of our fixed tabs
      for (const tab of FIXED_TABS) {
        if (normalize(tab) === normalizedType) {
          return tab;
        }
      }
    }

    // PRIORITY 2: If no explicit type or doesn't match, derive from content
    const desc = normalize(p.description || '');
    const data = normalize(p.data || '');
    const call = normalize(p.call || '');
    const validity = normalize(p.validity || p.Validity || '');
    const price = Number(p.price) || 0;

    // 1) UNLIMITED 5G: any plan mentioning 5G explicitly
    if (desc.includes("5G") || desc.includes("5 G") || data.includes("5G") || data.includes("5 G")) {
      return "UNLIMITED 5G";
    }

    // 2) DATA: data-only plans (No Calls / No Voice)
    if (desc.includes("NO CALLS") || desc.includes("NO VOICE") || desc.includes("DATA ONLY") || call.includes("NO CALLS")) {
      return "DATA";
    }

    // 3) SMART RECHARGE: short validity or very low price
    const daysMatch = validity.match(/(\d+)\s*DAY/i);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : null;
    if ((days && days <= 7) || price <= 100) {
      return "SMART RECHARGE";
    }

    // 4) TRULY UNLIMITED: longer validity with unlimited calls/data
    if (desc.includes("UNLIMITED") || data.includes("UNLIMITED") || call.includes("UNLIMITED") || desc.includes("TRULY")) {
      if (days && days >= 56) {
        return "TRULY UNLIMITED";
      }
    }

    // 5) RECOMMENDED: default / popular plans
    return "RECOMMENDED";
  }
}

  // Filter plans by Type / Category (explicit `type` or derived from details)
  const filteredPlans = plans.filter((p) => {
    const category = getCategoryForPlan(p);
    return normalize(category) === normalize(activeTab);
  });

  // Recharge Handler
  async function handleRecharge(p) {
    const login = localStorage.getItem("loggedIn");
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    if (!login) {
      alert("Please login first!");
      navigate("/login");
      return;
    }

    const token = localStorage.getItem('token');
    
    try {
      // Save to MongoDB first (if user is authenticated)
      if (token) {
        const currentMobile = localStorage.getItem("currentMobile") || "0000000000";
        
        console.log("💾 Saving recharge to MongoDB...", {
          planId: p.id,
          phoneNumber: currentMobile,
          operator: "Airtel",
          amount: p.price,
        });

        const response = await fetch("https://rechargeapp-backend.onrender.com/api/recharge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: currentUser?.id, // extra safety on backend
            planId: null, // Skip planId for mockapi plans
            phoneNumber: currentMobile,
            operator: "Airtel",
            amount: p.price,
            planDetails: {
              mockApiId: p.id,
              validity: p.Validity,
              data: p.data,
              call: p.call,
              type: p.Type,
            },
          }),
        });

        let result = {};
        try {
          result = await response.json();
        } catch {
          // ignore JSON parse errors, we'll fall back to status text
        }

        if (response.ok && result.success !== false) {
          console.log(
            "✅ Recharge saved to MongoDB successfully:",
            result.recharge || result
          );
          alert("Recharge successful and added to your history.");
        } else {
          console.error("❌ MongoDB save failed:", result);
          const msg =
            result.message ||
            response.statusText ||
            "Unknown error while saving to MongoDB";
          alert("Recharge failed: " + msg);
          return; // don't continue to local history / navigation on hard failure
        }
      } else {
        console.log("⚠️ No token found, saving only to localStorage");
        alert("Recharge successful and stored locally.");
      }
    } catch (error) {
      console.error("❌ Recharge save error:", error);
      alert("Recharge failed: " + error.message);
      return; // stop here on hard error
    }

    // Also save to localStorage per user for UI / analytics
    if (currentUser && currentUser.email) {
      const key = `rechargeHistory_${currentUser.email}`;
      const currentHistory = JSON.parse(localStorage.getItem(key) || "[]");

      const newEntry = {
        price: p.price,
        Validity: p.validity || p.Validity,
        data: p.data,
        call: p.call,
        operator: p.operator || "Airtel",
        Type: getCategoryForPlan(p),
        date: new Date().toISOString(),
      };

      currentHistory.push(newEntry);
      localStorage.setItem(key, JSON.stringify(currentHistory));

      // Keep a global copy for admin analytics (sum of all users)
      const globalHistory =
        JSON.parse(localStorage.getItem("rechargeHistory") || "[]");
      globalHistory.push({ ...newEntry, userEmail: currentUser.email });
      localStorage.setItem(
        "rechargeHistory",
        JSON.stringify(globalHistory)
      );
    }

    // Redirect to history
    navigate("/history");
  }

  return (
    <div className="plans-page">
      <h2 className="plans-title">Select Plan</h2>

      {/* Tabs */}
      <div className="plans-tabs">
        {FIXED_TABS.map((tab) => (
          <button
            key={tab}
            className={`plan-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <hr />

      {/* Plans List */}
      <div className="plans-list">
        {filteredPlans.length === 0 ? (
          <p>No plans available in this category</p>
        ) : (
          filteredPlans.map((p) => (
          <div className="plan-box" key={p._id || p.id}>
              <div className="plan-info">
                <h3 className="plan-price">₹{p.price}</h3>
                <p className="plan-validity">
                  {p.validity || p.Validity} • {p.data}
                </p>
                <p className="plan-calls">{p.call}</p>
                {p.description && (
                  <p className="plan-description">{p.description}</p>
                )}
              </div>

              <button
                className="apply-btn"
                onClick={() => handleRecharge(p)}
              >
                Recharge
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

