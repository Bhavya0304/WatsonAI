import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Chat from "./pages/Chat";

// Admin is code-split so visitors never download dashboard code.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Sessions = lazy(() => import("./pages/admin/Sessions"));
const SessionDetail = lazy(() => import("./pages/admin/SessionDetail"));
const Requests = lazy(() => import("./pages/admin/Requests"));
const LlmCalls = lazy(() => import("./pages/admin/LlmCalls"));
const Logs = lazy(() => import("./pages/admin/Logs"));
const ContentPage = lazy(() => import("./pages/admin/ContentPage"));
const Settings = lazy(() => import("./pages/admin/Settings"));

export default function App() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-ink-950" />}>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="requests" element={<Requests />} />
          <Route path="models" element={<LlmCalls />} />
          <Route path="logs" element={<Logs />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
