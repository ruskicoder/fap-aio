export const dom = {
  waitForElement: (selector: string, timeout = 5000): Promise<Element | null> => {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  },

  createElement: (tag: string, attributes: Record<string, string> = {}, text?: string): HTMLElement => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (text) {
      element.textContent = text;
    }
    return element;
  },
  
  injectStyles: (css: string) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
  },

  enhanceUI: () => {
    // Add back button before user div
    const userDiv = document.querySelector('#ctl00_divUser') as HTMLElement;
    if (userDiv && !document.querySelector('.fap-back-button')) {
      const backButton = document.createElement('a');
      backButton.href = 'https://fap.fpt.edu.vn/Student.aspx';
      backButton.className = 'fap-back-button';
      backButton.innerHTML = '← Home';
      backButton.style.cssText = `
        float: left;
        margin-right: 16px;
        padding: 0.3125rem 0.625rem;
        background-color: #0f0905;
        color: #E0E0E0;
        border-radius: 0.25rem;
        border: 0.0625rem solid #333333;
        text-decoration: none;
        display: inline-block;
        font-weight: 600;
        transition: all 0.2s ease;
      `;
      
      // Add hover effect via style element
      const hoverStyle = document.createElement('style');
      hoverStyle.textContent = `
        .fap-back-button:hover {
          background-color: #F36B16 !important;
          color: #000000 !important;
          border-color: #F36B16 !important;
        }
      `;
      document.head.appendChild(hoverStyle);
      
      userDiv.parentElement?.insertBefore(backButton, userDiv);
    }

    // Make title clickable
    const headings = Array.from(document.querySelectorAll('h1, h2'));
    const titleHeading = headings.find(h => 
      h.textContent?.includes('FPT University Academic Portal')
    ) as HTMLElement;
    
    if (titleHeading && !titleHeading.querySelector('a')) {
      const link = document.createElement('a');
      link.href = 'https://fap.fpt.edu.vn/Student.aspx';
      link.style.cssText = `
        color: #E0E0E0 !important;
        text-decoration: none !important;
        padding: 0;
        display: inline-block;
        transition: color 0.2s ease;
      `;
      link.innerHTML = titleHeading.innerHTML;
      titleHeading.innerHTML = '';
      titleHeading.appendChild(link);
      
      // Add hover effect
      const titleHoverStyle = document.createElement('style');
      titleHoverStyle.textContent = `
        h1 a:hover, h2 a:hover {
          color: #F36B16 !important;
        }
      `;
      document.head.appendChild(titleHoverStyle);
    }

    // Restore breadcrumb visibility
    const breadcrumb = document.querySelector('.breadcrumb') as HTMLElement;
    if (breadcrumb) {
      breadcrumb.style.display = 'block';
      breadcrumb.style.visibility = 'visible';
    }

    // Apply semester colors to table cells containing semester text
    const semesterPattern = /^(Fall|Spring|Summer)(20\d{2})$/;
    const tableCells = document.querySelectorAll('table td, table th');
    
    tableCells.forEach((cell) => {
      const text = cell.textContent?.trim();
      if (text && semesterPattern.test(text)) {
        cell.classList.add(text);
      }
    });

    // Apply status colors to spans containing Passed/Not Passed
    const statusSpans = document.querySelectorAll('table td span, table th span');
    statusSpans.forEach((span) => {
      const text = span.textContent?.trim();
      if (text === 'Passed') {
        span.classList.add('status-passed');
      } else if (text === 'Not Passed') {
        span.classList.add('status-not-passed');
      }
    });
  },

  applySemesterColors: (container: Element | Document = document) => {
    const semesterPattern = /^(Fall|Spring|Summer)(20\d{2})$/;
    const tableCells = container.querySelectorAll('table td, table th');
    
    tableCells.forEach((cell) => {
      const text = cell.textContent?.trim();
      if (text && semesterPattern.test(text)) {
        cell.classList.add(text);
      }
    });

    // Apply status colors to spans containing Passed/Not Passed
    const statusSpans = container.querySelectorAll('table td span, table th span');
    statusSpans.forEach((span) => {
      const text = span.textContent?.trim();
      if (text === 'Passed') {
        span.classList.add('status-passed');
      } else if (text === 'Not Passed') {
        span.classList.add('status-not-passed');
      }
    });
  }
};
