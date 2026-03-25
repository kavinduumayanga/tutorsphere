const fs = require('fs');

let content = fs.readFileSync('src/components/pages/TutorProfilePage.tsx', 'utf-8');

// Find the start and end of Availability & Features
const startMarker = `                    {/* Availability & Features Section */}`;
const endMarker = `                    </section>\n                  </motion.div>\n                )}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + `                    </section>`.length;

if (startIndex === -1 || endIndex < startIndex) {
  console.log("Could not find section");
  process.exit(1);
}

const replacement = `                    {/* Weekly Availability Section */}
                    <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
                      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-slate-900">Weekly Availability</h3>
                            <p className="text-sm text-slate-500 mt-0.5">Select a time that works best for you</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-200"></div> Available</div>
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-sm"></div> Booked</div>
                        </div>
                      </div>
                      
                      <div className="p-6 md:p-8 bg-slate-50/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {[
                            { day: 'Monday', slots: ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'] },
                            { day: 'Tuesday', slots: ['10:00 AM', '03:00 PM', '06:00 PM'] },
                            { day: 'Wednesday', slots: ['09:00 AM', '01:00 PM', '05:00 PM'] },
                            { day: 'Thursday', slots: [] },
                            { day: 'Friday', slots: ['08:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'] },
                            { day: 'Saturday', slots: ['10:00 AM', '12:00 PM', '02:00 PM'] },
                            { day: 'Sunday', slots: [] },
                          ].map((schedule) => (
                            <div key={schedule.day} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col max-h-[280px]">
                              <h4 className="font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                                {schedule.day}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md">{schedule.slots.length} slots</span>
                              </h4>
                              {schedule.slots.length > 0 ? (
                                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                                  {schedule.slots.map((time, i) => (
                                    <button 
                                      key={i} 
                                      onClick={() => onBookSession(tutorId)} 
                                      className="w-full py-2.5 px-3 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 text-slate-600 text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow text-center group flex justify-center items-center gap-1.5"
                                    >
                                      <Clock className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -ml-5 group-hover:ml-0 transition-all" />
                                      {time}
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
                    </section>`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

// Find the start and end of Mini Availability Preview
const startMini = `              {/* Mini Availability Preview */}`;
const endMini = `              </div>\n          </div>\n\n        </div>`;

const miniStartIndex = content.indexOf(startMini);
const miniEndIndex = content.indexOf(endMini);

if (miniStartIndex !== -1 && miniEndIndex > miniStartIndex) {
  content = content.substring(0, miniStartIndex) + content.substring(miniEndIndex + `              </div>\n`.length);
}

fs.writeFileSync('src/components/pages/TutorProfilePage.tsx', content);
console.log("Done");
