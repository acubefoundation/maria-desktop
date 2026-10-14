import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CaretDown, Calendar, Check, Clock, X } from '@phosphor-icons/react';
import {
  gregorianToEthiopian,
  ethiopianToGregorian,
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_MONTHS_AMHARIC,
  getEthiopianDaysInMonth,
} from '../../lib/ethiopianCalendar';
import './EthiopianDatePicker.css';

/* ============================================================
   Helpers
   ============================================================ */
function getMonthOptions(language) {
  const isAmharic = language === 'amharic';
  const months = isAmharic ? ETHIOPIAN_MONTHS_AMHARIC : ETHIOPIAN_MONTHS;
  return months.map((name, index) => ({ value: index, label: name }));
}

function getDayOptions(year, month) {
  if (year === null || month === null) return [];
  const daysInMonth = getEthiopianDaysInMonth(year, month);
  return Array.from({ length: daysInMonth }, (_, index) => index + 1);
}

/* Leading blanks (weekday offset) for the 1st of the Ethiopian month,
   derived from the Gregorian weekday of that Ethiopian day. */
function getFirstDayOffset(year, month) {
  try {
    return ethiopianToGregorian(year, month, 1).getDay(); // 0 = Sunday
  } catch {
    return 0;
  }
}

function buildGregorianISO(y, m, d, h = 0, min = 0, showTime = false) {
  if (y === null || m === null || d === null) return '';
  try {
    const date = ethiopianToGregorian(y, m, d);
    if (showTime) date.setHours(h, min, 0, 0);
    const Y = String(date.getFullYear()).padStart(4, '0');
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    if (!showTime) return `${Y}-${M}-${D}`;
    const H = String(date.getHours()).padStart(2, '0');
    const Min = String(date.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D}T${H}:${Min}`;
  } catch {
    return '';
  }
}

/* ============================================================
   Main Component
   ============================================================ */
export function EthiopianDatePicker({
  value,
  onChange,
  label = 'Date',
  required = false,
  language = 'english',
  showTime = false,
  placeholder = 'Select date',
  error,
  disabled = false,
  className = '',
  name,
  id,
  minDate,
  maxDate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [ethYear, setEthYear] = useState(null);
  const [ethMonth, setEthMonth] = useState(null);
  const [ethDay, setEthDay] = useState(null);

  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [yearInputStr, setYearInputStr] = useState('');
  const [hourInputStr, setHourInputStr] = useState('12');
  const [minuteInputStr, setMinuteInputStr] = useState('00');

  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dayGridRef = useRef(null);
  const yearListRef = useRef(null);

  const currentEth = useMemo(() => gregorianToEthiopian(new Date()), []);
  const monthOptions = useMemo(() => getMonthOptions(language), [language]);
  const dayOptions = useMemo(() => getDayOptions(ethYear, ethMonth), [ethYear, ethMonth]);
  const firstDayOffset = useMemo(
    () => (ethYear !== null && ethMonth !== null ? getFirstDayOffset(ethYear, ethMonth) : 0),
    [ethYear, ethMonth]
  );

  const yearOptions = useMemo(() => {
    const baseYear = ethYear ?? currentEth.year;
    const list = [];
    for (let y = baseYear - 10; y <= baseYear + 20; y++) {
      if (y > 0) list.push(y);
    }
    return list;
  }, [ethYear, currentEth.year]);

  /* ---------- min/max range in Ethiopian coords (min/max may be
     Gregorian ISO strings or Dates) ---------- */
  const minEth = useMemo(() => {
    if (!minDate) return null;
    const d = minDate instanceof Date ? minDate : new Date(minDate);
    return Number.isNaN(d.getTime()) ? null : gregorianToEthiopian(d);
  }, [minDate]);

  const maxEth = useMemo(() => {
    if (!maxDate) return null;
    const d = maxDate instanceof Date ? maxDate : new Date(maxDate);
    return Number.isNaN(d.getTime()) ? null : gregorianToEthiopian(d);
  }, [maxDate]);

  const yearOutOfRange = useCallback(
    (y) => (minEth && y < minEth.year) || (maxEth && y > maxEth.year),
    [minEth, maxEth]
  );
  const monthOutOfRange = useCallback(
    (y, m) => {
      if (yearOutOfRange(y)) return true;
      if (minEth && y === minEth.year && m < minEth.month) return true;
      if (maxEth && y === maxEth.year && m > maxEth.month) return true;
      return false;
    },
    [yearOutOfRange, minEth, maxEth]
  );
  const dayOutOfRange = useCallback(
    (y, m, d) => {
      if (monthOutOfRange(y, m)) return true;
      if (minEth && y === minEth.year && m === minEth.month && d < minEth.day) return true;
      if (maxEth && y === maxEth.year && m === maxEth.month && d > maxEth.day) return true;
      return false;
    },
    [monthOutOfRange, minEth, maxEth]
  );

  /* ---------- Parse incoming value ---------- */
  /*
   * Seeded with null, not `value`. Seeding it with the incoming value made this
   * effect bail on mount, so a value supplied on the first render was never
   * parsed and the picker silently fell back to its own `new Date()` default -
   * which is why editing an entry always showed today. null is never equal to
   * the string a form supplies, so the first run always parses.
   */
  const prevValueRef = useRef(null);
  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;

    if (!value) {
      setEthYear(null);
      setEthMonth(null);
      setEthDay(null);
      setYearInputStr('');
      if (showTime) {
        setHour(12);
        setMinute(0);
        setHourInputStr('12');
        setMinuteInputStr('00');
      }
      return;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      setEthYear(null);
      setEthMonth(null);
      setEthDay(null);
      setYearInputStr('');
      return;
    }

    const eth = gregorianToEthiopian(date);
    setEthYear(eth.year);
    setEthMonth(eth.month);
    setEthDay(eth.day);
    setYearInputStr(String(eth.year));

    if (showTime) {
      setHour(date.getHours());
      setMinute(date.getMinutes());
      setHourInputStr(String(date.getHours()).padStart(2, '0'));
      setMinuteInputStr(String(date.getMinutes()).padStart(2, '0'));
    }
  }, [value, showTime]);

  /* ---------- Display ---------- */
  const displayValue = useMemo(() => {
    if (ethYear === null || ethMonth === null || ethDay === null) return placeholder;
    const monthName =
      language === 'amharic' ? ETHIOPIAN_MONTHS_AMHARIC[ethMonth] : ETHIOPIAN_MONTHS[ethMonth];
    let result = `${monthName} ${ethDay}, ${ethYear}`;
    if (showTime) {
      result += ` ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return result;
  }, [ethYear, ethMonth, ethDay, language, showTime, hour, minute, placeholder]);

  const ethiopianInputValue = useMemo(() => {
    if (ethYear === null || ethMonth === null || ethDay === null) return '';
    return [
      String(ethYear).padStart(4, '0'),
      String(ethMonth + 1).padStart(2, '0'),
      String(ethDay).padStart(2, '0'),
    ].join('-');
  }, [ethYear, ethMonth, ethDay]);

  /* ---------- Emit (explicit args — never stale) ---------- */
  const notifyParent = (y, m, d, h = hour, min = minute) => {
    const iso = buildGregorianISO(y, m, d, h, min, showTime);
    onChange?.(iso);
  };

  /* ---------- Outside click / Escape ---------- */
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveField(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setActiveField(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  /* ---------- Auto-scroll selected day & year into view ---------- */
  useEffect(() => {
    if (activeField === 'day') {
      dayGridRef.current
        ?.querySelector('.ethiopian-date-picker__option.selected')
        ?.scrollIntoView({ block: 'nearest' });
    }
    if (activeField === 'year') {
      yearListRef.current
        ?.querySelector('.ethiopian-date-picker__option.selected')
        ?.scrollIntoView({ block: 'center' });
    }
  }, [activeField, ethDay, ethYear]);

  /* ---------- Field handlers ---------- */
  const handleYearSelect = (year) => {
    if (yearOutOfRange(year)) return;
    const validYear = Math.max(1, Math.min(9999, year));
    setEthYear(validYear);
    setYearInputStr(String(validYear));
    if (ethMonth !== null) {
      if (monthOutOfRange(validYear, ethMonth)) {
        setEthMonth(minEth && validYear === minEth.year ? minEth.month : null);
        setEthDay(null);
        setActiveField('month');
        return;
      }
      if (ethDay !== null) {
        const maxDay = getEthiopianDaysInMonth(validYear, ethMonth);
        if (ethDay > maxDay) setEthDay(maxDay);
      }
    }
    setActiveField('month');
  };

  const handleYearInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 4) {
      setYearInputStr(raw);
      if (raw.length > 0) {
        const parsed = parseInt(raw, 10);
        if (parsed > 0) setEthYear(parsed);
      }
    }
  };

  const handleYearInputBlur = () => {
    if (!yearInputStr || parseInt(yearInputStr, 10) <= 0 || yearOutOfRange(parseInt(yearInputStr, 10))) {
      const fallback = ethYear ?? currentEth.year;
      setEthYear(fallback);
      setYearInputStr(String(fallback));
    }
  };

  const handleMonthSelect = (month) => {
    if (monthOutOfRange(ethYear, month)) return;
    setEthMonth(month);
    if (ethDay !== null) {
      const maxDay = getEthiopianDaysInMonth(ethYear, month);
      if (ethDay > maxDay) setEthDay(maxDay);
    }
    setActiveField('day');
  };

  const handleDaySelect = (day) => {
    if (dayOutOfRange(ethYear, ethMonth, day)) return;
    setEthDay(day);
    if (showTime) {
      setActiveField('time');
    } else {
      setActiveField(null);
      setIsOpen(false);
      notifyParent(ethYear, ethMonth, day); // emit the NEW day immediately
      triggerRef.current?.focus();
    }
  };

  const handleToday = () => {
    setEthYear(currentEth.year);
    setEthMonth(currentEth.month);
    setEthDay(currentEth.day);
    setYearInputStr(String(currentEth.year));
    if (showTime) {
      setActiveField('time');
    } else {
      setActiveField(null);
      setIsOpen(false);
      notifyParent(currentEth.year, currentEth.month, currentEth.day);
      triggerRef.current?.focus();
    }
  };

  /* ---------- Time ---------- */
  const handleHourInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setHourInputStr('');
      return;
    }
    let num = parseInt(val, 10);
    if (num > 23) num = 23;
    setHour(num);
    setHourInputStr(val.length > 2 ? String(num) : val);
  };

  const handleHourBlur = () => {
    let num = parseInt(hourInputStr, 10);
    if (Number.isNaN(num) || num < 0) num = 0;
    if (num > 23) num = 23;
    setHour(num);
    setHourInputStr(String(num).padStart(2, '0'));
  };

  const handleMinuteInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setMinuteInputStr('');
      return;
    }
    let num = parseInt(val, 10);
    if (num > 59) num = 59;
    setMinute(num);
    setMinuteInputStr(val.length > 2 ? String(num) : val);
  };

  const handleMinuteBlur = () => {
    let num = parseInt(minuteInputStr, 10);
    if (Number.isNaN(num) || num < 0) num = 0;
    if (num > 59) num = 59;
    setMinute(num);
    setMinuteInputStr(String(num).padStart(2, '0'));
  };

  const setTimePreset = (h, m) => {
    setHour(h);
    setMinute(m);
    setHourInputStr(String(h).padStart(2, '0'));
    setMinuteInputStr(String(m).padStart(2, '0'));
  };

  const handleTimeDone = () => {
    setActiveField(null);
    setIsOpen(false);
    notifyParent(ethYear, ethMonth, ethDay, hour, minute);
    triggerRef.current?.focus();
  };

  /* ---------- Clear (emits '' immediately) ---------- */
  const clearValue = (event) => {
    event.stopPropagation();
    setEthYear(null);
    setEthMonth(null);
    setEthDay(null);
    setYearInputStr('');
    setHour(12);
    setMinute(0);
    setHourInputStr('12');
    setMinuteInputStr('00');
    setActiveField(null);
    setIsOpen(false);
    onChange?.('');
  };

  const handleInputClick = () => {
    if (disabled) return;
    if (ethYear === null) return openField('year');
    if (ethMonth === null) return openField('month');
    if (ethDay === null) return openField('day');
    openField('month');
  };

  const openField = (field) => {
    if (disabled) return;
    setActiveField(field);
    setIsOpen(true);
  };

  /* ---------- Arrow-key navigation for the day grid ---------- */
  const handleDayGridKeyDown = (event) => {
    if (ethYear === null || ethMonth === null) return;
    const maxDay = getEthiopianDaysInMonth(ethYear, ethMonth);
    const current = ethDay ?? 1;
    let next = null;
    switch (event.key) {
      case 'ArrowRight': next = current + 1; break;
      case 'ArrowLeft': next = current - 1; break;
      case 'ArrowDown': next = current + 7; break;
      case 'ArrowUp': next = current - 7; break;
      case 'Home': next = 1; break;
      case 'End': next = maxDay; break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (ethDay !== null) handleDaySelect(ethDay);
        return;
      default: return;
    }
    event.preventDefault();
    next = Math.max(1, Math.min(maxDay, next));
    if (!dayOutOfRange(ethYear, ethMonth, next)) setEthDay(next);
  };

  const isCurrentYear = (y) => y === currentEth.year;
  const isCurrentMonth = (m) => ethYear === currentEth.year && m === currentEth.month;
  const isCurrentDay = (d) =>
    ethYear === currentEth.year && ethMonth === currentEth.month && d === currentEth.day;

  const WEEKDAYS = language === 'amharic'
    ? ['እሑድ', 'ሰኞ', 'ማክሰ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div
      ref={wrapperRef}
      className={[
        'ethiopian-date-picker',
        isOpen ? 'open' : '',
        error ? 'has-error' : '',
        disabled ? 'disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Label */}
      {label && (
        <label className="ethiopian-date-picker__label" id={id ? `${id}-label` : undefined} htmlFor={id}>
          {label} {required && <span className="req-star">*</span>}
        </label>
      )}

      {/* Input Display Box */}
      <div
        ref={triggerRef}
        className="ethiopian-date-picker__input-wrapper"
        onClick={handleInputClick}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-labelledby={id ? `${id}-label` : undefined}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowDown' && !isOpen)) {
            e.preventDefault();
            handleInputClick();
          }
        }}
      >
        <Calendar
          className="ethiopian-date-picker__icon"
          size={18}
          weight="regular"
          color={error ? 'var(--color-error)' : 'var(--color-tertiary)'}
        />

        <div className="ethiopian-date-picker__display">
          <span className={ethYear === null ? 'placeholder' : ''}>{displayValue}</span>
          {ethYear !== null && !disabled && (
            <button
              type="button"
              className="ethiopian-date-picker__clear"
              onClick={clearValue}
              aria-label="Clear date"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>

        <CaretDown
          className={['ethiopian-date-picker__chevron', isOpen ? 'rotated' : '']
            .filter(Boolean)
            .join(' ')}
          size={16}
          weight="bold"
          color="var(--color-tertiary)"
        />
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="ethiopian-date-picker__dropdown"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Choose Ethiopian date"
        >
          {/* Top Breadcrumb Navigation */}
          <div className="ethiopian-date-picker__navigation" role="group" aria-label="Selected parts">
            <button
              type="button"
              className={activeField === 'year' ? 'active' : ''}
              onClick={() => setActiveField('year')}
              aria-current={activeField === 'year'}
            >
              {ethYear ?? 'Year'}
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className={activeField === 'month' ? 'active' : ''}
              onClick={() => ethYear !== null && setActiveField('month')}
              disabled={ethYear === null}
            >
              {ethMonth !== null ? monthOptions[ethMonth]?.label : 'Month'}
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className={activeField === 'day' ? 'active' : ''}
              onClick={() => ethYear !== null && ethMonth !== null && setActiveField('day')}
              disabled={ethYear === null || ethMonth === null}
            >
              {ethDay ?? 'Day'}
            </button>
            {showTime && (
              <>
                <span className="time-divider" aria-hidden="true">|</span>
                <button
                  type="button"
                  className={activeField === 'time' ? 'active' : ''}
                  onClick={() =>
                    ethYear !== null && ethMonth !== null && ethDay !== null && setActiveField('time')
                  }
                  disabled={ethYear === null || ethMonth === null || ethDay === null}
                >
                  {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
                </button>
              </>
            )}
          </div>

          {/* YEAR FIELD */}
          {activeField === 'year' && (
            <div className="ethiopian-date-picker__dropdown-content">
              <div className="ethiopian-date-picker__year-input-container">
                <button
                  type="button"
                  className="ethiopian-date-picker__year-btn"
                  onClick={() => handleYearSelect((ethYear ?? currentEth.year) - 1)}
                  aria-label="Previous year"
                >
                  −
                </button>
                <div className="ethiopian-date-picker__year-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="ethiopian-date-picker__year-input"
                    placeholder="YYYY"
                    value={yearInputStr}
                    onChange={handleYearInputChange}
                    onBlur={handleYearInputBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleYearSelect(parseInt(yearInputStr, 10))}
                    maxLength={4}
                    aria-label="Year"
                  />
                  <span className="ethiopian-date-picker__year-label">Year</span>
                </div>
                <button
                  type="button"
                  className="ethiopian-date-picker__year-btn"
                  onClick={() => handleYearSelect((ethYear ?? currentEth.year) + 1)}
                  aria-label="Next year"
                >
                  +
                </button>
              </div>

              <div className="ethiopian-date-picker__options" ref={yearListRef} role="listbox" aria-label="Year">
                {yearOptions.map((year) => {
                  const out = yearOutOfRange(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={ethYear === year}
                      disabled={out}
                      className={[
                        'ethiopian-date-picker__option',
                        ethYear === year ? 'selected' : '',
                        isCurrentYear(year) ? 'current' : '',
                        out ? 'out-of-range' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleYearSelect(year)}
                    >
                      <span>{year}</span>
                      {isCurrentYear(year) && <span className="ethiopian-date-picker__badge">Current</span>}
                      {ethYear === year && <Check size={16} weight="bold" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MONTH FIELD */}
          {activeField === 'month' && (
            <div className="ethiopian-date-picker__dropdown-content">
              <div className="ethiopian-date-picker__dropdown-header">
                <span>Month</span>
                {ethMonth !== null && (
                  <span className="selected-preview">{monthOptions[ethMonth]?.label}</span>
                )}
              </div>
              <div className="ethiopian-date-picker__options" role="listbox" aria-label="Month">
                {monthOptions.map((month) => {
                  const out = monthOutOfRange(ethYear, month.value);
                  return (
                    <button
                      key={month.value}
                      type="button"
                      role="option"
                      aria-selected={ethMonth === month.value}
                      disabled={out}
                      className={[
                        'ethiopian-date-picker__option',
                        ethMonth === month.value ? 'selected' : '',
                        isCurrentMonth(month.value) ? 'current' : '',
                        out ? 'out-of-range' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleMonthSelect(month.value)}
                    >
                      <span className="ethiopian-date-picker__option-number">
                        {String(month.value + 1).padStart(2, '0')}
                      </span>
                      <span className="ethiopian-date-picker__option-name">{month.label}</span>
                      {isCurrentMonth(month.value) && (
                        <span className="ethiopian-date-picker__badge">Current</span>
                      )}
                      {ethMonth === month.value && <Check size={16} weight="bold" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAY FIELD — weekday-aligned grid */}
          {activeField === 'day' && (
            <div className="ethiopian-date-picker__dropdown-content">
              <div className="ethiopian-date-picker__dropdown-header">
                <span>
                  {monthOptions[ethMonth]?.label} {ethYear}
                </span>
                <div className="ethiopian-date-picker__header-actions">
                  <button type="button" className="ethiopian-date-picker__today-btn" onClick={handleToday}>
                    Today
                  </button>
                </div>
              </div>
              <div className="ethiopian-date-picker__weekdays" role="presentation">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div
                className="ethiopian-date-picker__options ethiopian-date-picker__options--days"
                ref={dayGridRef}
                role="listbox"
                aria-label="Day"
                tabIndex={0}
                onKeyDown={handleDayGridKeyDown}
              >
                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <span key={`blank-${i}`} className="ethiopian-date-picker__blank" aria-hidden="true" />
                ))}
                {dayOptions.map((day) => {
                  const out = dayOutOfRange(ethYear, ethMonth, day);
                  const isSelected = ethDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={out}
                      disabled={out}
                      className={[
                        'ethiopian-date-picker__option',
                        isSelected ? 'selected' : '',
                        isCurrentDay(day) ? 'current' : '',
                        out ? 'out-of-range' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDaySelect(day)}
                    >
                      <span>{day}</span>
                      {isCurrentDay(day) && <span className="ethiopian-date-picker__dot" aria-label="Today" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIME FIELD */}
          {showTime && activeField === 'time' && (
            <div className="ethiopian-date-picker__dropdown-content ethiopian-date-picker__time-picker">
              <div className="ethiopian-date-picker__time-header">
                <Clock size={17} weight="regular" />
                <span>Set Time (24h)</span>
              </div>

              <div className="ethiopian-date-picker__time-inputs">
                <div className="ethiopian-date-picker__time-field">
                  <label htmlFor={id ? `${id}-hour` : undefined}>Hour (0-23)</label>
                  <input
                    id={id ? `${id}-hour` : undefined}
                    type="text"
                    inputMode="numeric"
                    className="ethiopian-date-picker__time-numeric-input"
                    value={hourInputStr}
                    onChange={handleHourInputChange}
                    onBlur={handleHourBlur}
                    placeholder="HH"
                    maxLength={2}
                    aria-label="Hour"
                  />
                </div>

                <span className="ethiopian-date-picker__time-separator" aria-hidden="true">:</span>

                <div className="ethiopian-date-picker__time-field">
                  <label htmlFor={id ? `${id}-minute` : undefined}>Minute (0-59)</label>
                  <input
                    id={id ? `${id}-minute` : undefined}
                    type="text"
                    inputMode="numeric"
                    className="ethiopian-date-picker__time-numeric-input"
                    value={minuteInputStr}
                    onChange={handleMinuteInputChange}
                    onBlur={handleMinuteBlur}
                    placeholder="MM"
                    maxLength={2}
                    aria-label="Minute"
                  />
                </div>
              </div>

              <div className="ethiopian-date-picker__time-presets">
                {[[9, 0], [12, 0], [15, 0], [18, 0]].map(([h, m]) => (
                  <button key={h} type="button" onClick={() => setTimePreset(h, m)}>
                    {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>

              <button type="button" className="ethiopian-date-picker__time-done" onClick={handleTimeDone}>
                Done
              </button>
            </div>
          )}

          {/* Footer Bar */}
          {ethYear !== null && ethMonth !== null && ethDay !== null && activeField !== 'time' && (
            <div className="ethiopian-date-picker__footer">
              <div className="ethiopian-date-picker__footer-date">
                <Calendar size={15} weight="regular" />
                <span>{displayValue}</span>
              </div>
              <button
                type="button"
                className="ethiopian-date-picker__done"
                onClick={() => {
                  setActiveField(null);
                  setIsOpen(false);
                  notifyParent(ethYear, ethMonth, ethDay);
                  triggerRef.current?.focus();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <span className="ethiopian-date-picker__error" role="alert">
          {error}
        </span>
      )}

      {/* Hidden Fields for Forms */}
      <input type="hidden" name={name} value={buildGregorianISO(ethYear, ethMonth, ethDay, hour, minute, showTime)} readOnly />
      <input type="hidden" value={ethiopianInputValue} readOnly aria-hidden="true" />
    </div>
  );
}

export default EthiopianDatePicker;
