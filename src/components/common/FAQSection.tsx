import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQSectionProps {
  faqs: FAQItem[];
  title?: string;
  subtitle?: string;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ 
  faqs, 
  title = "Frequently Asked Questions", 
  subtitle = "Everything you need to know about the platform." 
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="max-w-3xl mx-auto w-full py-8">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900">{title}</h2>
        {subtitle && <p className="text-base text-slate-600">{subtitle}</p>}
      </div>
      
      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          
          return (
            <motion.div 
              key={index}
              initial={false}
              animate={{ 
                backgroundColor: isOpen ? '#f8fafc' : '#ffffff',
                borderColor: isOpen ? '#e2e8f0' : '#f1f5f9'
              }}
              className="border-2 rounded-xl overflow-hidden transition-colors duration-200 cursor-pointer group"
              onClick={() => toggleFAQ(index)}
            >
              <div className="flex justify-between items-center p-4 text-left w-full h-full">
                <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors pr-6">
                  {faq.question}
                </h3>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
                    isOpen 
                      ? 'bg-indigo-100 text-indigo-600' 
                      : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </div>
              
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
