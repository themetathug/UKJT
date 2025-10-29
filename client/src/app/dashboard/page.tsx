'use client';

import { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { CustomCursor } from '../../components/CustomCursor';
import { ParticleBackground } from '../../components/ParticleBackground';
import { GlassCard } from '../../components/GlassCard';
import { FlipCard } from '../../components/FlipCard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('30');
  const [stats, setStats] = useState({
    totalApplications: 47,
    weeklyApplications: 12,
    averageTimePerApp: 25,
    responseRate: 18.5,
    responsesReceived: 8,
    currentStreak: 5,
    longestStreak: 12,
    weeklyGoal: 15,
    weeklyAchievement: 80,
    coldEmailsSent: 23,
    coldEmailResponses: 4,
    coldEmailConversionRate: 17.4,
    bestDayOfWeek: 'Tuesday',
    bestTimeOfDay: '10:00 AM',
    averageResponseTime: 3.2,
    cvVersionPerformance: [
      { name: 'Tech-focused CV v2.1', applications: 15, interviews: 4, conversionRate: 26.7 },
      { name: 'General CV v1.8', applications: 20, interviews: 3, conversionRate: 15.0 },
      { name: 'Startup CV v1.2', applications: 12, interviews: 1, conversionRate: 8.3 }
    ]
  });

  // Chart data
  const lineChartData = {
    labels: ['19 Jan', '20 Jan', '21 Jan', '22 Jan', '23 Jan', '24 Jan', '25 Jan'],
    datasets: [{
      label: 'Applications',
      data: [3, 5, 2, 6, 3, 7, 4],
      borderColor: '#000000',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      tension: 0.4,
    }]
  };

  const statusChartData = {
    labels: ['Applied', 'Viewed', 'Shortlisted', 'Interviewed', 'Offered', 'Rejected'],
    datasets: [{
      data: [47, 28, 12, 8, 3, 15],
      backgroundColor: ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#e5e5e5'],
    }]
  };

  const sourceBarData = {
    labels: ['LinkedIn', 'Indeed', 'Company Sites', 'Referrals', 'Recruiters'],
    datasets: [{
      label: 'Applications',
      data: [15, 12, 8, 7, 5],
      backgroundColor: '#000000',
    }]
  };

  return (
    <>
      <CustomCursor />
      <ParticleBackground />
      
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white border-b-2 border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-black">UK Jobs Insider</span>
              </div>
              
              <div className="flex space-x-6">
                <button className="px-4 py-2 text-black font-medium border-b-2 border-black">
                  Dashboard
                </button>
                <button 
                  onClick={() => window.location.href = '/services'}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Services
                </button>
                <button
                  onClick={() => toast('Applications page coming soon')}
                  className="px-4 py-2 text-gray-700 hover:text-black font-medium transition"
                >
                  Applications
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-green-50 border-2 border-green-500 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                ✓ All Systems Active
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-bold text-black mb-2">Dashboard</h1>
                <p className="text-gray-600 text-lg">Track, analyze, and optimize your job search journey</p>
              </div>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {['7', '30', '90'].map((days) => (
              <motion.button
                key={days}
                onClick={() => setTimeRange(days)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  timeRange === days 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last {days} days
              </motion.button>
            ))}
          </div>

          {/* Key Metrics - 3D Flip Cards with FIXED HEIGHT */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
            style={{ minHeight: '315px' }}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            <MetricCard3D
              title="Total Applications"
              value={stats.totalApplications}
              subtitle={`${stats.weeklyApplications} this week`}
              icon="📊"
              trend={stats.weeklyApplications}
              trendPositive={true}
              detailedStats={{
                thisWeek: stats.weeklyApplications,
                lastWeek: 8,
                thisMonth: 47,
                avgPerDay: 1.6
              }}
            />
            
            <MetricCard3D
              title="Avg. Time per App"
              value={`${stats.averageTimePerApp}m`}
              subtitle="Efficiency metric"
              icon="⏱️"
              trend={5}
              trendPositive={false}
              detailedStats={{
                fastest: '12m',
                slowest: '45m',
                target: '20m',
                improvement: '+15%'
              }}
            />
            
            <MetricCard3D
              title="Response Rate"
              value={`${stats.responseRate.toFixed(1)}%`}
              subtitle={`${stats.responsesReceived} responses`}
              icon="📧"
              trend={stats.responseRate > 15 ? 8 : -3}
              trendPositive={stats.responseRate > 15}
              detailedStats={{
                responses: stats.responsesReceived,
                interviews: 3,
                offers: 1,
                pending: 12
              }}
            />
            
            <MetricCard3D
              title="Current Streak"
              value={`${stats.currentStreak} days`}
              subtitle={`Best: ${stats.longestStreak} days`}
              icon="🔥"
              trend={stats.currentStreak}
              trendPositive={true}
              detailedStats={{
                current: stats.currentStreak,
                longest: stats.longestStreak,
                thisMonth: 15,
                goal: 30
              }}
            />
          </motion.div>

          {/* Charts Section - 3D Glass Cards - ALL SAME HEIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ minHeight: '350px' }}>
            {/* Application Trend */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <GlassCard className="p-6 h-full" depth="heavy">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-black">Application Trend</h3>
                  <motion.div 
                    className="flex items-center space-x-2"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span className="text-sm text-gray-600 font-medium">Live Data</span>
                  </motion.div>
                </div>
                <div style={{ height: '250px' }}>
                  <Line 
                    data={lineChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          padding: 16,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: '#000000',
                          borderWidth: 1,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { precision: 0, color: '#666666' },
                          grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: {
                          ticks: { color: '#666666' },
                          grid: { display: false }
                        }
                      }
                    }}
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* Application Status */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="h-full"
            >
              <GlassCard className="p-6 h-full" depth="heavy">
                <h3 className="text-2xl font-bold text-black mb-4">Application Status</h3>
                <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut 
                    data={statusChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 15,
                            font: { size: 12, weight: 'bold' },
                            color: '#000000',
                            usePointStyle: true,
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          padding: 15,
                          titleFont: { size: 14 },
                          bodyFont: { size: 13 },
                          borderColor: '#000000',
                          borderWidth: 1,
                        }
                      }
                    }}
                  />
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Source Performance & Cold Email Stats - SAME HEIGHT AS CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ minHeight: '350px' }}>
            <GlassCard className="p-6 h-full" depth="medium">
              <h3 className="text-2xl font-bold text-black mb-4">Performance by Job Board</h3>
              <div style={{ height: '250px' }}>
                <Bar 
                  data={sourceBarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                      },
                      x: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              </div>
            </GlassCard>

            {/* Cold Email Metrics */}
            <GlassCard className="p-6 h-full" depth="medium">
              <h3 className="text-2xl font-bold text-black mb-6">Cold Email Performance</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Emails Sent</span>
                  <span className="text-2xl font-bold">{stats.coldEmailsSent}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Responses</span>
                  <span className="text-2xl font-bold">{stats.coldEmailResponses}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-black text-white rounded-xl"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
                >
                  <span className="font-medium">Conversion Rate</span>
                  <span className="text-2xl font-bold">{stats.coldEmailConversionRate}%</span>
                </motion.div>
              </div>
            </GlassCard>
          </div>

          {/* CV Performance - SMALLER SIZE */}
          <GlassCard className="p-5 mb-8" depth="medium">
            <h3 className="text-xl font-bold text-black mb-4">CV Version Performance</h3>
            <div className="space-y-3">
              {stats.cvVersionPerformance.map((cv, index) => (
                <motion.div 
                  key={index} 
                  className="bg-gray-50 p-3 rounded-xl"
                  whileHover={{ scale: 1.01, x: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-black">{cv.name}</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-black">{cv.conversionRate.toFixed(1)}%</span>
                      <p className="text-xs text-gray-600">{cv.interviews} interviews</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="bg-black h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${cv.conversionRate}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{cv.applications} applications</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Goal Achievement & Timing Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Goal Achievement */}
            <motion.div 
              className="bg-black text-white rounded-xl p-8 shadow-sm"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.3)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-3xl font-bold">Weekly Goal</h3>
                  <p className="text-gray-300 mt-2">{stats.weeklyApplications}/{stats.weeklyGoal} applications</p>
                </div>
                <div className="text-6xl font-bold">
                  {stats.weeklyAchievement}%
                </div>
              </div>
              <div className="mt-6 bg-white/20 rounded-full h-4 overflow-hidden">
                <motion.div 
                  className="bg-white h-4 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(stats.weeklyAchievement, 100)}%` }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </motion.div>

            {/* Best Timing */}
            <motion.div 
              className="bg-white border-2 border-gray-200 rounded-xl p-8 shadow-sm"
              whileHover={{ 
                y: -3, 
                boxShadow: "0 15px 30px rgba(0,0,0,0.1)"
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <h3 className="text-2xl font-bold text-black mb-6">Optimal Application Timing</h3>
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Best Day</span>
                  <span className="text-xl font-bold text-black">{stats.bestDayOfWeek}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-gray-700 font-medium">Best Time</span>
                  <span className="text-xl font-bold text-black">{stats.bestTimeOfDay}</span>
                </motion.div>
                <motion.div 
                  className="flex items-center justify-between p-4 bg-black text-white rounded-xl"
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
                >
                  <span className="font-medium">Avg. Response Time</span>
                  <span className="text-xl font-bold">{stats.averageResponseTime} days</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Add Application FAB */}
        <motion.button
          onClick={() => toast.success('Add application feature coming soon!')}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-8 right-8 bg-black text-white p-6 rounded-full shadow-2xl z-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </motion.button>
      </div>
    </>
  );
}

// 3D Metric Card Component with Flip Card - FIXED HEIGHT
function MetricCard3D({ title, value, subtitle, icon, trend, trendPositive, detailedStats }: any) {
  const front = (
    <GlassCard className="p-6 h-full" depth="medium">
      <div className="flex items-center justify-between mb-4">
        <motion.div 
          className="text-4xl"
          animate={{ 
            rotateY: [0, 10, 0, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {icon}
        </motion.div>
        {typeof trend === 'number' && (
          <motion.div 
            className={`px-3 py-1 rounded-full text-sm font-bold ${trendPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            whileHover={{ scale: 1.1 }}
            animate={{ 
              y: [0, -2, 0],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {trendPositive ? '↑' : '↓'} {Math.abs(trend)}%
          </motion.div>
        )}
      </div>
      <motion.h3 
        className="text-3xl font-bold text-black mb-2"
        animate={{ 
          scale: [1, 1.02, 1]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {value}
      </motion.h3>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
      )}
      <motion.div 
        className="mt-2 text-xs text-gray-400 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        👆 Click to see details
      </motion.div>
    </GlassCard>
  );

  const back = (
    <GlassCard className="p-6 h-full bg-gradient-to-br from-black to-gray-800 text-white" depth="heavy">
      <div className="flex items-center justify-between mb-4">
        <motion.div 
          className="text-4xl"
          animate={{ rotateZ: 360 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>
      </div>
      <h3 className="text-2xl font-bold mb-3">{title} Details</h3>
      
      {detailedStats ? (
        <div className="space-y-2 text-sm">
          {Object.entries(detailedStats).map(([key, val]: [string, any], index) => (
            <motion.div 
              key={key} 
              className="flex justify-between items-center py-1 border-b border-white/10"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <span className="text-white/70 capitalize text-xs">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="text-white font-bold text-sm">{typeof val === 'number' ? val.toLocaleString() : val}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-white/10">
            <span className="text-white/70 text-xs">Weekly Growth</span>
            <span className="text-white font-bold text-sm">{trend}%</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/10">
            <span className="text-white/70 text-xs">Target</span>
            <span className="text-white font-bold text-sm">On Track</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-white/70 text-xs">Status</span>
            <span className="text-green-400 font-bold text-sm">✓ Active</span>
          </div>
        </div>
      )}
      
      <motion.div 
        className="mt-2 text-xs text-white/50 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        👆 Click to flip back
      </motion.div>
    </GlassCard>
  );

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.9 },
        visible: { opacity: 1, y: 0, scale: 1 }
      }}
      className="h-full"
      style={{ height: '180px' }} // FIXED HEIGHT TO PREVENT OVERLAP
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <FlipCard 
        front={front} 
        back={back}
        flipOnClick={true}
        animationDuration={0.6}
      />
    </motion.div>
  );
}