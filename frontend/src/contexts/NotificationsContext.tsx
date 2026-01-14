'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { initializeEcho, disconnectEcho, getEcho } from '@/lib/echo';
import api from '@/lib/api';

interface NotificationData {
  title?: string;
  message?: string;
  po_number?: string;
  status?: string;
  shipment_number?: string;
  result?: string;
  [key: string]: unknown;
}

interface RawNotification {
  id: string;
  type: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
}

interface WebSocketNotification {
  id?: string;
  type: string;
  title?: string;
  message?: string;
  data?: NotificationData;
}

interface PurchaseOrderEvent {
  po_number: string;
  [key: string]: unknown;
}

interface SampleEvent {
  status: string;
  [key: string]: unknown;
}

interface QualityInspectionEvent {
  result: string;
  [key: string]: unknown;
}

interface ShipmentEvent {
  shipment_number: string;
  status: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: NotificationData;
  read_at: string | null;
  created_at: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
};

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read_at).length;

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await api.get<{ data: RawNotification[] }>('/notifications');
      const rawNotifications = response.data.data || [];

      // Transform backend response to match interface
      const transformedNotifications: Notification[] = rawNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.data?.title || 'Notification',
        message: n.data?.message || '',
        data: n.data || {},
        read_at: n.read_at,
        created_at: n.created_at,
      }));

      setNotifications(transformedNotifications);
    } catch (error: unknown) {
      // Only log error if it's not a 404 (endpoint not implemented yet)
      const err = error as { response?: { status?: number } };
      if (err?.response?.status !== 404) {
        console.error('Failed to fetch notifications:', error);
      }
      // Set empty notifications array on error
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Initialize Echo and set up listeners when user logs in
  useEffect(() => {
    if (!user) {
      disconnectEcho();
      setNotifications([]);
      return;
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Initialize Echo
    const echo = initializeEcho(token);

    // Listen to private user channel for notifications
    echo
      .private(`App.Models.User.${user.id}`)
      .notification((notification: WebSocketNotification) => {
        console.log('New notification received:', notification);

        // Add new notification to the list
        const newNotification: Notification = {
          id: notification.id || Date.now().toString(),
          type: notification.type,
          title: notification.title || 'New Notification',
          message: notification.message || '',
          data: notification.data || {},
          read_at: null,
          created_at: new Date().toISOString(),
        };

        setNotifications(prev => [newNotification, ...prev]);

        // Show browser notification if permitted
        if ('Notification' in window && window.Notification.permission === 'granted') {
          new window.Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/favicon.ico',
          });
        }
      });

    // Listen to specific channels for real-time updates

    // Purchase Orders channel
    echo.private(`purchase-orders.${user.id}`).listen('.PurchaseOrderUpdated', (e: PurchaseOrderEvent) => {
      console.log('Purchase Order Updated:', e);
      const notification: Notification = {
        id: Date.now().toString(),
        type: 'purchase_order_updated',
        title: 'Purchase Order Updated',
        message: `PO ${e.po_number} has been updated`,
        data: e as NotificationData,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setNotifications(prev => [notification, ...prev]);
    });

    // Samples channel
    echo.private(`samples.${user.id}`).listen('.SampleStatusChanged', (e: SampleEvent) => {
      console.log('Sample Status Changed:', e);
      const notification: Notification = {
        id: Date.now().toString(),
        type: 'sample_status_changed',
        title: 'Sample Status Update',
        message: `Sample status changed to ${e.status}`,
        data: e as NotificationData,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setNotifications(prev => [notification, ...prev]);
    });

    // Quality Inspections channel
    echo.private(`quality-inspections.${user.id}`).listen('.QualityInspectionCompleted', (e: QualityInspectionEvent) => {
      console.log('Quality Inspection Completed:', e);
      const notification: Notification = {
        id: Date.now().toString(),
        type: 'quality_inspection_completed',
        title: 'Quality Inspection Completed',
        message: `Inspection result: ${e.result}`,
        data: e as NotificationData,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setNotifications(prev => [notification, ...prev]);
    });

    // Shipments channel
    echo.private(`shipments.${user.id}`).listen('.ShipmentStatusUpdated', (e: ShipmentEvent) => {
      console.log('Shipment Status Updated:', e);
      const notification: Notification = {
        id: Date.now().toString(),
        type: 'shipment_status_updated',
        title: 'Shipment Update',
        message: `Shipment ${e.shipment_number} is now ${e.status}`,
        data: e as NotificationData,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setNotifications(prev => [notification, ...prev]);
    });

    // Fetch initial notifications
    fetchNotifications();

    // Cleanup on unmount
    return () => {
      echo.leave(`App.Models.User.${user.id}`);
      echo.leave(`purchase-orders.${user.id}`);
      echo.leave(`samples.${user.id}`);
      echo.leave(`quality-inspections.${user.id}`);
      echo.leave(`shipments.${user.id}`);
    };
  }, [user, fetchNotifications]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
