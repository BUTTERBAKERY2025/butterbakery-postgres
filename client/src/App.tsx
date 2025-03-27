import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

// Import pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import DailySales from "@/pages/daily-sales";
import DailyReports from "@/pages/daily-reports";
import Targets from "@/pages/targets";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import Branches from "@/pages/branches";
import Settings from "@/pages/settings";
import Permissions from "@/pages/permissions";
import ConsolidatedJournal from "@/pages/consolidated-journal";
import AIAnalytics from "@/pages/ai-analytics";
import SmartAlerts from "@/pages/smart-alerts";
import Rewards from "@/pages/rewards";
import LeaderboardsPage from "@/pages/leaderboards";
import DatabaseMonitor from "@/pages/database-monitor";
import CashBox from "@/pages/cash-box";

// i18n setup
import '@/lib/i18n';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/daily-sales" component={DailySales} />
      <Route path="/daily-reports" component={DailyReports} />
      <Route path="/targets" component={Targets} />
      <Route path="/reports" component={Reports} />
      <Route path="/consolidated-journal" component={ConsolidatedJournal} />
      <Route path="/ai-analytics" component={AIAnalytics} />
      <Route path="/smart-alerts" component={SmartAlerts} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/leaderboards" component={LeaderboardsPage} />
      <Route path="/database-monitor" component={DatabaseMonitor} />
      <Route path="/cash-box" component={CashBox} />
      <Route path="/users" component={Users} />
      <Route path="/branches" component={Branches} />
      <Route path="/settings" component={Settings} />
      <Route path="/permissions" component={Permissions} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
