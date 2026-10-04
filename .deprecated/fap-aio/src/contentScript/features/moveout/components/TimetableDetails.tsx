import React from "react";

interface TimetableDetailsProps {}

const TimetableDetails: React.FC<TimetableDetailsProps> = () => {
  return (
    <details className="p-4 [&_svg]:open:-rotate-180" style={{ width: '100%' }}>
      <summary className="flex cursor-pointer list-none items-center gap-4 text-xl font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all">
        <div>
          <svg
            className="rotate-0 transform transition-all duration-300"
            fill="none"
            height={20}
            width={20}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div>Thời khóa biểu</div>
      </summary>
      <iframe
        id="myframe"
        src="https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx"
        className="w-full border"
        style={{ width: '100%', height: '80vh', minHeight: '600px' }}
      ></iframe>
    </details>
  );
};

export default TimetableDetails;
