"use client";

import { useState } from 'react';
import { Phone, Mail, MessageSquare, AlertTriangle, Users, Send, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

interface EmergencyLog {
  id: string;
  timestamp: Date;
  type: 'medication_missed' | 'health_concern' | 'manual_alert';
  message: string;
  contactsNotified: string[];
  resolved: boolean;
}

export default function EmergencyAlert() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const [emergencyLogs, setEmergencyLogs] = useState<EmergencyLog[]>([]);

  // Placeholder for database integration
  const loadContactsFromDB = async () => {
    // TODO: Implement database loading
    console.log('TODO: Load emergency contacts from database');
  };

  const addContact = (contact: Omit<EmergencyContact, 'id'>) => {
    // TODO: Save to database
    const newContact: EmergencyContact = {
      ...contact,
      id: Date.now().toString()
    };
    setContacts(prev => [...prev, newContact]);
    toast.success(`Added ${contact.name} to emergency contacts`);
  };
  const [isManualAlert, setIsManualAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const sendEmergencyAlert = async (
    type: EmergencyLog['type'], 
    message: string, 
    contactIds?: string[]
  ) => {
    const contactsToNotify = contactIds 
      ? contacts.filter(c => contactIds.includes(c.id))
      : contacts.filter(c => c.isPrimary);

    // Create emergency log entry
    const newLog: EmergencyLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message,
      contactsNotified: contactsToNotify.map(c => c.name),
      resolved: false
    };

    setEmergencyLogs(prev => [newLog, ...prev]);

    // Simulate sending notifications
    for (const contact of contactsToNotify) {
      await simulateNotification(contact, message, type);
    }

    toast.success(`Emergency alert sent to ${contactsToNotify.length} contacts`);
    
    return newLog.id;
  };

  const simulateNotification = async (
    contact: EmergencyContact, 
    message: string, 
    type: EmergencyLog['type']
  ) => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const notificationData = {
      to: contact,
      message: `HEALTH ALERT: ${message}`,
      timestamp: new Date().toISOString(),
      type: type
    };

    // In a real app, this would call your notification service
    console.log('Sending notification:', notificationData);

    // Simulate different notification methods
    if (contact.phone) {
      console.log(`SMS sent to ${contact.phone}: ${message}`);
    }
    
    if (contact.email) {
      console.log(`Email sent to ${contact.email}: ${message}`);
    }
  };

  const handleManualAlert = async () => {
    if (!alertMessage.trim()) {
      toast.error('Please enter an alert message');
      return;
    }

    await sendEmergencyAlert('manual_alert', alertMessage);
    setAlertMessage('');
    setIsManualAlert(false);
  };

  const handleQuickAlert = async (alertType: string) => {
    const quickMessages = {
      'feeling_unwell': "I'm not feeling well and may need assistance. Please check on me.",
      'medication_help': "I need help with my medications. Please contact me.",
      'emergency': "This is an emergency. Please come immediately or call 911.",
      'check_in': "Please give me a call when you have a moment."
    };

    const message = quickMessages[alertType as keyof typeof quickMessages] || alertType;
    await sendEmergencyAlert('manual_alert', message);
  };

  const resolveAlert = (logId: string) => {
    setEmergencyLogs(prev => 
      prev.map(log => 
        log.id === logId 
          ? { ...log, resolved: true }
          : log
      )
    );
    toast.success('Alert marked as resolved');
  };

  const getAlertTypeIcon = (type: EmergencyLog['type']) => {
    switch (type) {
      case 'medication_missed':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'health_concern':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'manual_alert':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAlertTypeLabel = (type: EmergencyLog['type']) => {
    switch (type) {
      case 'medication_missed':
        return 'Medication Alert';
      case 'health_concern':
        return 'Health Concern';
      case 'manual_alert':
        return 'Manual Alert';
      default:
        return 'Alert';
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Contacts */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Emergency Contacts
        </h3>
        
        {contacts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <div className="text-gray-400 mb-4">
              <Users className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Emergency Contacts</h3>
            <p className="text-gray-500 mb-4">Add family members and healthcare providers for emergencies</p>
            <button 
              onClick={() => toast.success('TODO: Add contact form')}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + Add First Contact
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-4 rounded-lg border-2 ${
                  contact.isPrimary 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-800">{contact.name}</h4>
                    <p className="text-sm text-gray-600">{contact.relationship}</p>
                  </div>
                  {contact.isPrimary && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    Primary
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{contact.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{contact.email}</span>
                </div>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Alert Buttons */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Quick Alerts</h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleQuickAlert('feeling_unwell')}
            className="p-4 bg-yellow-100 hover:bg-yellow-200 border-2 border-yellow-300 rounded-lg text-center transition-colors"
          >
            <AlertTriangle className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-yellow-800">Not Feeling Well</p>
          </button>
          
          <button
            onClick={() => handleQuickAlert('medication_help')}
            className="p-4 bg-blue-100 hover:bg-blue-200 border-2 border-blue-300 rounded-lg text-center transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-800">Medication Help</p>
          </button>
          
          <button
            onClick={() => handleQuickAlert('emergency')}
            className="p-4 bg-red-100 hover:bg-red-200 border-2 border-red-300 rounded-lg text-center transition-colors"
          >
            <Phone className="w-6 h-6 text-red-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-800">Emergency</p>
          </button>
          
          <button
            onClick={() => handleQuickAlert('check_in')}
            className="p-4 bg-green-100 hover:bg-green-200 border-2 border-green-300 rounded-lg text-center transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-800">Check In</p>
          </button>
        </div>
      </div>

      {/* Custom Alert */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Custom Alert</h3>
        
        {!isManualAlert ? (
          <button
            onClick={() => setIsManualAlert(true)}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + Send Custom Alert Message
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="Describe your situation or what help you need..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={handleManualAlert}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Alert
              </button>
              <button
                onClick={() => {
                  setIsManualAlert(false);
                  setAlertMessage('');
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      {emergencyLogs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Alerts</h3>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {emergencyLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border ${
                  log.resolved 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertTypeIcon(log.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-800">{getAlertTypeLabel(log.type)}</h4>
                        {log.resolved && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {log.timestamp.toLocaleString()} • Notified: {log.contactsNotified.join(', ')}
                      </p>
                    </div>
                  </div>
                  
                  {!log.resolved && (
                    <button
                      onClick={() => resolveAlert(log.id)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 