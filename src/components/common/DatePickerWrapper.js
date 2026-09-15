import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/datepicker.css';

const DatePickerWrapper = ({
  date,
  handleDateChange,
  isRange = false,
  placeholderText,
  wrapperColor = 'bg-white',
  wrapperOpacity = '',
  containerClassName = ''
}) => {
  const [calendarMonth, setCalendarMonth] = useState(0);
  const currentYear = useMemo(() => {
    if (isRange && Array.isArray(date)) {
      return (date[1] || date[0] || new Date()).getFullYear();
    } else if (date) {
      return (Array.isArray(date) ? date[0] : date).getFullYear();
    }
    return new Date().getFullYear();
  }, [date, isRange]);
  
  const years = useMemo(() => 
    Array.from({ length: 201 }, (_, i) => currentYear - 100 + i),
    [currentYear]
  );
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Apply custom styles for selected dates
  const dayClassName = (date) => {
    return "react-datepicker__day custom-day";
  };
  
  return (
    <motion.div
      className={`${wrapperColor} ${wrapperOpacity} rounded-md border border-gray-300 shadow-sm p-2 flex items-center ${containerClassName}`}
      whileHover={{
        borderColor: "#9CA3AF"
      }}
    >
      <div className="flex items-center gap-3 w-full">
        <DatePicker
          selected={isRange ? (Array.isArray(date) ? date[0] : null) : date}
          onChange={handleDateChange}
          startDate={isRange && Array.isArray(date) ? date[0] : null}
          endDate={isRange && Array.isArray(date) ? date[1] : null}
          selectsRange={isRange}
          dateFormat="yyyy-MM-dd"
          placeholderText={placeholderText || "Select date"}
          className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-500 w-full text-center"
          calendarClassName={`custom-calendar calendar-month-${calendarMonth % 2} shadow-lg border border-gray-200 rounded-md`}
          onMonthChange={() => setCalendarMonth(value => value + 1)}
          onYearChange={() => setCalendarMonth(value => value + 1)}
          wrapperClassName="date-picker-wrapper w-full"
          popperClassName="date-picker-popper"
          dayClassName={dayClassName}
          renderCustomHeader={({
            date: headerDate,
            changeYear,
            changeMonth,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled,
          }) => (
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <button 
                onClick={decreaseMonth} 
                disabled={prevMonthButtonDisabled} 
                className={`flex items-center justify-center w-8 h-8 rounded-md ${
                  prevMonthButtonDisabled ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <div className="flex gap-2">
                <select
                  value={headerDate.getFullYear()}
                  onChange={({ target: { value } }) => changeYear(Number(value))}
                  className="px-2 py-1 text-sm border border-gray-200 rounded-md bg-white text-gray-800 font-medium"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                
                <select
                  value={months[headerDate.getMonth()]}
                  onChange={({ target: { value } }) =>
                    changeMonth(months.indexOf(value))
                  }
                  className="px-2 py-1 text-sm border border-gray-200 rounded-md bg-white text-gray-800 font-medium"
                >
                  {months.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={increaseMonth} 
                disabled={nextMonthButtonDisabled} 
                className={`flex items-center justify-center w-8 h-8 rounded-md ${
                  nextMonthButtonDisabled ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L7 7L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        />
      </div>
    </motion.div>
  );
};

export default DatePickerWrapper;