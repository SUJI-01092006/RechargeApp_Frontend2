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
        console.log("API Response:", res.data);
        const plansData = res.data?.plans || res.data || [];
        console.log("Plans loaded:", plansData.length);
        setPlans(plansData);
      })
      .catch((error) => {
        console.error("API Error:", error);
        // Fallback sample data for testing
        const samplePlans = [
          { _id: "1", price: 199, validity: "28 Days", data: "1.5GB/Day", call: "Unlimited", description: "Popular plan" },
          { _id: "2", price: 49, validity: "1 Day", data: "1GB", call: "100 mins", description: "Quick recharge" },
          { _id: "3", price: 599, validity: "84 Days", data: "Unlimited", call: "Unlimited", description: "Long term unlimited" },
          { _id: "4", price: 299, validity: "30 Days", data: "25GB", call: "No Voice", description: "Data only plan" },
          { _id: "5", price: 999, validity: "365 Days", data: "2GB/Day 5G", call: "Unlimited", description: "5G Annual plan" }
        ];
        setPlans(samplePlans);
      });
  }, []);

  // Normalize for matching text
  function normalize(str) {
    if (!str) return "";
    return str.toString().trim().toUpperCase().replace(/\s+/g, " ");
  }

  // Decide which tab/category a plan belongs to based on its details
  function getCategoryForPlan(p) {
    // If backend already set an explicit type/category, use that
    if (p.type || p.Type) {
      return p.type || p.Type;
    }

    const desc = normalize(p.description || "");
    const data = normalize(p.data || "");
    const call = normalize(p.call || "");
    const validity = normalize(p.validity || p.Validity || "");
    const price = Number(p.price) || 0;

    // Extract days from validity
    const daysMatch = validity.match(/(\d+)\s*DAY/i);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : null;

    console.log(`Plan ₹${price}: days=${days}, data="${data}", call="${call}"`);

    // 1) UNLIMITED 5G: plans with "UNLIMITED 5G" in data
    if (data.includes("UNLIMITED 5G")) {
      return "UNLIMITED 5G";
    }

    // 2) SMART RECHARGE: 1-day plans
    if (days === 1) {
      return "SMART RECHARGE";
    }

    // 3) DATA: plans with "NO CALLS" in call field
    if (call.includes("NO CALLS")) {
      return "DATA";
    }

    // 4) TRULY UNLIMITED: 56+ days with unlimited calls
    if (days && days >= 56 && call.includes("UNLIMITED CALLS")) {
      return "TRULY UNLIMITED";
    }

    // 5) RECOMMENDED: everything else
    return "RECOMMENDED";
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

      {/* Debug Info */}
      <div style={{fontSize: '12px', color: '#666', marginBottom: '10px'}}>
        Total plans: {plans.length} | Filtered: {filteredPlans.length} | Active tab: {activeTab}
      </div>

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
                <small style={{color: '#999'}}>Category: {getCategoryForPlan(p)}</small>
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
