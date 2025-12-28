import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';

export default function MobileBookingCalendar() {
  const [selectedDate, setSelectedDate] = useState('21 oct.');
  const [selectedTime, setSelectedTime] = useState(null);

  const dates = [
    { day: 'Lun.', date: '20', month: 'Oct.', available: false },
    { day: 'Mar.', date: '21', month: 'Oct.', available: true },
    { day: 'Mer.', date: '22', month: 'Oct.', available: true },
    { day: 'Jeu.', date: '23', month: 'Oct.', available: true },
    { day: 'Ven.', date: '24', month: 'Oct.', available: true },
  ];

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', 
    '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-6 text-center">
        <h1 className="text-xl font-bold mb-1">Réserver un rendez-vous avec</h1>
        <h2 className="text-2xl font-bold mb-2">Jean-Michel Garnier</h2>
        <p className="text-blue-200 text-sm">Psychologue</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Sélection de la date */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white">
            <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-base">Cette semaine</h3>
            <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-5 gap-2">
              {dates.map((date, idx) => (
                <button
                  key={idx}
                  onClick={() => date.available && setSelectedDate(`${date.date} ${date.month.toLowerCase()}`)}
                  disabled={!date.available}
                  className={`p-3 rounded-xl text-center transition-all ${
                    !date.available
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : selectedDate === `${date.date} ${date.month.toLowerCase()}`
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent'
                  }`}
                >
                  <div className="text-xs font-medium mb-1">{date.day}</div>
                  <div className="text-2xl font-bold">{date.date}</div>
                  <div className="text-xs opacity-80">{date.month}</div>
                  {!date.available && (
                    <div className="text-xs mt-1">Aucun</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sélection de l'heure */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center gap-2 text-white">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold text-base">Sélectionnez l'heure</h3>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {timeSlots.map((time, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTime(time)}
                  className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    selectedTime === time
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
            
            {timeSlots.length > 12 && (
              <div className="text-center mt-3">
                <button className="text-blue-600 font-semibold text-sm hover:text-blue-700">
                  Voir plus de disponibilités
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bouton de confirmation */}
        {selectedTime && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 p-4 shadow-2xl">
            <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2">
              <Calendar className="w-5 h-5" />
              Réserver le {selectedDate} à {selectedTime}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}