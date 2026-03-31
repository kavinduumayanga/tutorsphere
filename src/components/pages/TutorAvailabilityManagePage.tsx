import React, { useEffect, useState } from 'react';
import { TimeSlot, Tutor } from '../../types';
import { Plus, Trash2, Calendar, Clock, AlertCircle, Save, ArrowLeft } from 'lucide-react';

interface Props {
  tutor?: Tutor;
  onSaveAvailability: (slots: TimeSlot[]) => Promise<void>;
  onBack: () => void;
}

export const TutorAvailabilityManagePage: React.FC<Props> = ({ tutor, onSaveAvailability, onBack }) => {
  const [slots, setSlots] = useState<TimeSlot[]>(tutor?.availability || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlots(tutor?.availability || []);
  }, [tutor]);

  if (!tutor) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <h2 className="text-2xl font-black text-slate-900">Tutor profile not found</h2>
        <p className="text-slate-600">We could not load your tutor availability yet. Please return to your dashboard and try again.</p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const addSlot = (day: string) => {
    const newSlot: TimeSlot = {
      id: Math.random().toString(36).substring(7),
      day,
      startTime: '09:00',
      endTime: '10:00',
      isBooked: false,
    };
    setSlots([...slots, newSlot]);
  };

  const removeSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id));
  };

  const updateSlot = (id: string, field: keyof TimeSlot, value: string) => {
    setSlots(slots.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const validateSlots = (): string | null => {
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        return 'All slots must have a start and end time.';
      }
      if (slot.startTime >= slot.endTime) {
        return `Start time must be before end time for ${slot.day}.`;
      }
    }

    for (const day of days) {
      const daySlots = slots
        .filter(s => s.day === day)
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (let i = 1; i < daySlots.length; i += 1) {
        if (daySlots[i].startTime < daySlots[i - 1].endTime) {
          return `Time slots overlap on ${day}.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateSlots();
    if (validationError) {
      alert(validationError);
      return;
    }

    setSaving(true);
    try {
      await onSaveAvailability(slots);
      alert("Availability configured successfully!");
    } catch (e) {
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Manage Availability
          </h2>
          <p className="text-slate-500 mt-2 text-lg">Configure your weekly schedule for school-level tutoring</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 text-indigo-800 rounded-2xl border border-indigo-100">
          <AlertCircle className="w-5 h-5 text-indigo-600" />
          <p className="text-sm font-medium">As a school-level tutor, keeping your availability up-to-date helps students find the perfect time for their classes.</p>
        </div>

        <div className="space-y-6">
          {days.map(day => {
            const daySlots = slots.filter(s => s.day === day);
            return (
              <div key={day} className="p-6 border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 text-lg w-24">{day}</h3>
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-100/50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Slot
                  </button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium py-3">No availability set for {day}</p>
                ) : (
                  <div className="space-y-3">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="w-4 h-4" />
                        </div>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlot(slot.id, 'startTime', e.target.value)}
                          className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all shrink-0"
                          disabled={slot.isBooked}
                        />
                        <span className="text-slate-400 font-medium px-2">to</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlot(slot.id, 'endTime', e.target.value)}
                          className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all shrink-0"
                          disabled={slot.isBooked}
                        />
                        <button
                          onClick={() => !slot.isBooked && removeSlot(slot.id)}
                          disabled={slot.isBooked}
                          className={`p-3 rounded-xl shrink-0 transition-colors flex items-center justify-center
                            ${slot.isBooked 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                          title={slot.isBooked ? "Cannot remove booked slot" : "Remove slot"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {slot.isBooked && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shrink-0">Booked</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
