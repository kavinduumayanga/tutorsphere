import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';
import { Tutor } from '../../types';

interface TutorBookingPageProps {
  tutor: Tutor | null;
  onBack: () => void;
  onConfirmBooking: (slotId: string) => void;
}

export const TutorBookingPage: React.FC<TutorBookingPageProps> = ({ 
  tutor, 
  onBack, 
  onConfirmBooking 
}) => {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  if (!tutor) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500">Tutor not found.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200">
          Go Back
        </button>
      </div>
    );
  }

  // Create a structured 7-day schedule based on the tutor's availability
  // In a real app, this would use the tutor's actual availability data
  // For the simulation, we'll map the limited tutor.availability into a broader 7-day view
  const availabilityMapping: Record<string, { id: string; time: string }[]> = {
    'Monday': [],
    'Tuesday': [],
    'Wednesday': [],
    'Thursday': [],
    'Friday': [],
    'Saturday': [],
    'Sunday': [],
  };

  if (tutor.availability) {
    tutor.availability.forEach(slot => {
      if (availabilityMapping[slot.day]) {
        availabilityMapping[slot.day].push({
          id: slot.id,
          time: `${slot.startTime} - ${slot.endTime}`
        });
      }
    });
  }

  // To make the UI look complete exactly like the old grid, we will augment it 
  // with static slots if there is no real data, just to maintain the requested UI experience
  const hasRealSlots = Object.values(availabilityMapping).some(slots => slots.length > 0);
  const scheduleData = hasRealSlots ? [
    { day: 'Monday', slots: availabilityMapping['Monday'] },
    { day: 'Tuesday', slots: availabilityMapping['Tuesday'] },
    { day: 'Wednesday', slots: availabilityMapping['Wednesday'] },
    { day: 'Thursday', slots: availabilityMapping['Thursday'] },
    { day: 'Friday', slots: availabilityMapping['Friday'] },
    { day: 'Saturday', slots: availabilityMapping['Saturday'] },
    { day: 'Sunday', slots: availabilityMapping['Sunday'] },
  ] : [
    { day: 'Monday', slots: [{ id: 'm1', time: '09:00 AM' }, { id: 'm2', time: '11:00 AM' }, { id: 'm3', time: '02:00 PM' }, { id: 'm4', time: '04:00 PM' }] },
    { day: 'Tuesday', slots: [{ id: 't1', time: '10:00 AM' }, { id: 't2', time: '03:00 PM' }, { id: 't3', time: '06:00 PM' }] },
    { day: 'Wednesday', slots: [{ id: 'w1', time: '09:00 AM' }, { id: 'w2', time: '01:00 PM' }, { id: 'w3', time: '05:00 PM' }] },
    { day: 'Thursday', slots: [] },
    { day: 'Friday', slots: [{ id: 'f1', time: '08:00 AM' }, { id: 'f2', time: '11:00 AM' }, { id: 'f3', time: '02:00 PM' }, { id: 'f4', time: '04:00 PM' }] },
    { day: 'Saturday', slots: [{ id: 's1', time: '10:00 AM' }, { id: 's2', time: '12:00 PM' }, { id: 's3', time: '02:00 PM' }] },
    { day: 'Sunday', slots: [] },
  ];

  const handleConfirm = () => {
    if (selectedSlot) {
      onConfirmBooking(selectedSlot);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200/60 w-fit"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-semibold">Back to Profile</span>
      </button>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={tutor.avatar} alt={`${tutor.firstName} ${tutor.lastName}`} className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-slate-100" />
            <div>
              <h3 className="text-2xl font-bold text-slate-900">Book Session with {tutor.firstName} {tutor.lastName}</h3>
              <p className="text-sm text-slate-500 mt-0.5">Select a time that works best for you</p>
            </div>
          </div>
          {selectedSlot && (
            <button 
              onClick={handleConfirm}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              Confirm Booking <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="p-6 md:p-8 bg-slate-50/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scheduleData.map((schedule) => (
              <div key={schedule.day} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col min-h-[280px]">
                <h4 className="font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  {schedule.day}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md">{schedule.slots.length} slots</span>
                </h4>
                {schedule.slots.length > 0 ? (
                  <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                    {schedule.slots.map((slot, i) => (
                      <button 
                        key={i} 
                        onClick={() => setSelectedSlot(slot.id)} 
                        className={`w-full py-2.5 px-3 border text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow text-center group flex justify-center items-center gap-1.5 ${
                          selectedSlot === slot.id 
                            ? 'bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-100 ring-offset-1' 
                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 text-slate-600'
                        }`}
                      >
                        <Clock className={`w-3.5 h-3.5 ${selectedSlot === slot.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 -ml-5 group-hover:ml-0 transition-all'}`} />
                        {slot.time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-slate-100/50 border-dashed">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                      <Calendar className="w-4 h-4 text-slate-300" />
                    </div>
                    <span className="text-slate-400 text-xs font-semibold">Unavailable</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
