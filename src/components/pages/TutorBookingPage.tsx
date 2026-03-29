import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Calendar, Clock, Globe, CheckCircle, Video, CreditCard } from "lucide-react";

interface TutorBookingPageProps {
  tutor: any;
  onBack: () => void;
  onConfirmBooking: (slotId: string) => void;
}

// Generate the next 7 days
const today = new Date();
const next7Days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() + i);
  return d;
});

const CONSTANT_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", 
  "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", 
  "03:00 PM", "04:00 PM", "05:00 PM"
];

export function TutorBookingPage({ tutor, onBack, onConfirmBooking }: TutorBookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(next7Days[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  if (!tutor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4 font-medium">Tutor not found.</p>
          <button onClick={onBack} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = tutor.user?.name || tutor.name || "Tutor";
  
  // Deterministic fake slots per date
  const availableSlots = CONSTANT_SLOTS.filter((_, i) => (selectedDate.getDate() + i) % 3 !== 0);

  const handleConfirm = () => {
    if (selectedSlot) {
      onConfirmBooking(`${selectedDate.toISOString().split('T')[0]}-${selectedSlot}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="hidden sm:inline">Back to Profile</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-200">
              {displayName.charAt(0)}
            </div>
            <div className="hidden sm:block text-right">
              <div className="font-bold text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500 font-medium">${tutor.pricePerHour}/hr • Video Session</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COL: Scheduler */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Select a Date & Time</h1>
                <div className="flex items-center gap-2 text-slate-500 mt-2 font-medium text-sm">
                  <Globe className="w-4 h-4" /> Timezone: <span className="text-slate-700 font-bold">Your Local Time</span>
                </div>
              </div>
              
              <div className="p-6 sm:p-8">
                {/* Date Selector */}
                <div className="mb-10">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Which day works best?
                  </h3>
                  
                  <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                    {next7Days.map((date, idx) => {
                      const isSelected = date.toDateString() === selectedDate.toDateString();
                      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                      const dayNum = date.getDate();
                      const monthName = date.toLocaleDateString("en-US", { month: "short" });
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                          className={`shrink-0 snap-start w-[84px] py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected 
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100" 
                              : "border-slate-100 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                            {dayName}
                          </span>
                          <span className={`text-2xl font-black ${isSelected ? "text-indigo-700" : "text-slate-900"}`}>
                            {dayNum}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                            {monthName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    Available Times
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                    {availableSlots.length > 0 ? (
                      availableSlots.map((time, idx) => {
                        const isSelected = selectedSlot === time;
                        
                        return (
                          <motion.button
                            key={idx}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedSlot(time)}
                            className={`py-3.5 px-2 sm:px-4 rounded-xl border-2 font-bold transition-colors text-sm flex items-center justify-center gap-2 ${
                              isSelected 
                                ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200 z-10" 
                                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:text-indigo-700 shadow-sm"
                            }`}
                          >
                            {isSelected && <CheckCircle className="w-4 h-4 shrink-0" />}
                            {time}
                          </motion.button>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <Clock className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-bold">No slots available on this date.</p>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Please select another day.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COL: Summary */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-50 border border-slate-200/60 p-6 sm:p-8 lg:sticky lg:top-28">
              <h3 className="text-xl font-black text-slate-900 mb-6">Booking Summary</h3>
              
              <div className="space-y-5 mb-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Date</div>
                    <div className="font-bold text-slate-900 leading-tight">
                      {selectedDate.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors border ${selectedSlot ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Time</div>
                    <div className={`font-bold leading-tight ${selectedSlot ? "text-indigo-600" : "text-slate-400"}`}>
                      {selectedSlot ? `${selectedSlot} - 1 Hour` : "Select a time"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                    <Video className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Session Type</div>
                    <div className="font-bold text-slate-900 leading-tight">1-on-1 Video Call</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 mb-8">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-bold text-slate-500">Rate per hour</span>
                  <span className="font-bold text-slate-900">${tutor.pricePerHour?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500">Service Fee</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Free</span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-lg">Total</span>
                  <span className="font-black text-slate-900 text-3xl tracking-tight">${tutor.pricePerHour?.toFixed(2)}</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: selectedSlot ? 1.02 : 1 }}
                whileTap={{ scale: selectedSlot ? 0.98 : 1 }}
                onClick={handleConfirm}
                disabled={!selectedSlot}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                  selectedSlot 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200" 
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {selectedSlot ? "Confirm Booking" : "Pick a Time"}
              </motion.button>
              
              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 py-2 rounded-lg">
                <CreditCard className="w-4 h-4 text-slate-300" /> No payment required yet
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
