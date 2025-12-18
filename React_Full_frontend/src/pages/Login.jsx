// src/pages/Login.jsx
import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../config/api";

console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🌍 Environment:', process.env.NODE_ENV);

export default function Login() {
  const navigate = useNavigate();

  // Validation schema
  const LoginSchema = Yup.object().shape({
    email: Yup.string().email("Invalid email").required("Email is required"),
    password: Yup.string()
      .min(6, "Password must be at least 6 characters")
      .required("Password is required"),
  });

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Login</h1>

        <Formik
          initialValues={{ email: "", password: "" }}
          validationSchema={LoginSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
              });
              
              const data = await response.json();
              
              if (response.ok && data.success) {
                console.log('✅ Login successful! Full response:', data);
                console.log('👤 data.role:', data.role);
                console.log('👤 data.user?.role:', data.user?.role);
                
                // Get role from response (try both locations)
                const userRole = data.role || data.user?.role || 'user';
                console.log('🎯 Final detected role:', userRole);
                
                // Store in localStorage
                localStorage.setItem("loggedIn", "true");
                localStorage.setItem("userRole", userRole);
                localStorage.setItem("token", data.token);
                
                // Store current user details
                if (data.user) {
                  localStorage.setItem(
                    "currentUser",
                    JSON.stringify({
                      id: data.user._id,
                      name: data.user.name,
                      email: data.user.email,
                      role: data.user.role,
                    })
                  );
                }
                
                alert(data.message || 'Login successful');
                
                // Navigate based on role
                if (userRole === 'admin') {
                  console.log('🔄 Admin detected - navigating to /admin');
                  navigate('/admin');
                } else {
                  console.log('🔄 Regular user - navigating to home');
                  navigate('/');
                }
              } else {
                alert(data.message || 'Login failed');
              }
            } catch (error) {
              console.error('Login error:', error);
              alert('Login failed. Please check if the server is running.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="login-form">
              <label>Email</label>
              <Field
                name="email"
                type="email"
                placeholder="Enter Email"
                className="input-field"
              />
              <ErrorMessage
                name="email"
                component="div"
                className="error-text"
              />

              <label>Password</label>
              <Field
                name="password"
                type="password"
                placeholder="Enter Password"
                className="input-field"
              />
              <ErrorMessage
                name="password"
                component="div"
                className="error-text"
              />

              <button
                type="submit"
                className="primary-button full-width"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </button>

              <p style={{ textAlign: "center", marginTop: "10px" }}>
                Don't have an account?{" "}
                <span
                  style={{ color: "var(--accent)", cursor: "pointer" }}
                  onClick={() => navigate("/register")}
                >
                  Create Account
                </span>
              </p>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
