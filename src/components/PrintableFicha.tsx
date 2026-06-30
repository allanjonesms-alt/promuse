import React, { forwardRef } from 'react';
import { Victim, Occurrence } from '../types';

interface PrintableFichaProps {
  victim: Victim;
  occurrences: Occurrence[];
}

export const PrintableFicha = forwardRef<HTMLDivElement, PrintableFichaProps>(
  ({ victim, occurrences }, ref) => {
    // Generate empty lines for the "AUTOR" section
    const autorLines = Array.from({ length: 15 });
    
    // Generate empty lines for the "EVOLUÇÃO" right column
    const evolucaoColLines = Array.from({ length: 15 });
    
    // Generate empty lines for the "EVOLUÇÃO" full width
    const evolucaoFullLines = Array.from({ length: 5 });

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const [year, month, day] = dateStr.split('-');
        if (!year || !month || !day) return dateStr;
        return `${day}/${month}/${year}`;
      } catch (e) {
        return dateStr;
      }
    };

    return (
      <div ref={ref} className="bg-white text-black font-sans" style={{ width: '210mm', margin: '0 auto' }}>
        {/* PAGE 1 */}
        <div className="pdf-page flex flex-col justify-between p-8" style={{ width: '210mm', height: '297mm', boxSizing: 'border-box' }}>
          <div>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-2">
              <div className="h-16 flex items-center justify-start">
                <img src="/header-pm.png" alt="Logo PM MS e SEJUSP" className="h-full object-contain" />
              </div>
              <div className="h-16 flex items-center justify-end">
                <img src="/logo-promuse.png" alt="Logo PROMUSE" className="h-full object-contain" />
              </div>
            </div>
            <div className="border-b-2 border-black pb-1 mb-6">
              <h1 className="font-bold text-sm">Coordenadoria Estadual do Programa Mulher Segura</h1>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-lg font-bold underline uppercase">FICHA INDIVIDUAL DE ATENDIMENTO 5º BPM</h2>
            </div>

          <table className="w-full border-collapse border border-black text-sm mb-8">
            <tbody>
              <tr>
                <td className="border border-black p-2 w-2/3 uppercase font-bold">PROCESSO Nº: <span className="font-normal">{victim.protectiveOrder?.orderNumber || ''}</span></td>
                <td className="border border-black p-2 w-1/3 uppercase font-bold">DATA INICIAL MPU: <span className="font-normal">{formatDate(victim.protectiveOrder?.issueDate)}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold" colSpan={2}>VÍTIMA: <span className="font-normal">{victim.name}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold" colSpan={2}>ENDEREÇO: <span className="font-normal">{victim.address}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold" colSpan={2}>TELEFONE: <span className="font-normal">{victim.phone}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold" colSpan={2}>VALIDADE DA MPU: <span className="font-normal">{formatDate(victim.protectiveOrder?.expiryDate)}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold" colSpan={2}>DISTÂNCIA: <span className="font-normal">{victim.protectiveOrder?.restrictions || ''}</span></td>
              </tr>
              <tr>
                <td className="border border-black p-2 uppercase font-bold align-top w-32 border-r-0">AUTOR:</td>
                <td className="border border-black p-0 border-l-0">
                  <div className="flex px-2 pt-2 pb-1 font-normal">
                    <div className="flex-1">
                      {victim.protectiveOrder?.defendantName || ''}
                    </div>
                    {victim.aggressorPhotoUrl && (
                      <div className="ml-4 h-24 w-24 border border-black overflow-hidden flex-shrink-0">
                        <img 
                          src={victim.aggressorPhotoUrl} 
                          alt="Foto do Autor" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  {autorLines.map((_, i) => (
                    <div key={i} className="border-b border-black h-8 w-full last:border-b-0"></div>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* FOOTER */}
          <div className="text-center mt-auto pt-4">
            <h2 className="text-sm">5º Batalhão de Polícia Militar de Mato Grosso do Sul</h2>
            <p className="text-xs">Av. General Mendes de Moraes, Centro, 190, Coxim – MS</p>
            <p className="text-xs">Fone: (67) 99251-2905 - Mail: promusecoordenacao@gmail.com</p>
          </div>
        </div>

        {/* PAGE 2 */}
        <div className="pdf-page flex flex-col justify-between p-8" style={{ width: '210mm', height: '297mm', boxSizing: 'border-box' }}>
          <div>
            {/* HEADER PAGE 2 */}
            <div className="flex justify-between items-center mb-2">
              <div className="h-16 flex items-center justify-start">
                <img src="/header-pm.png" alt="Logo PM MS e SEJUSP" className="h-full object-contain" />
              </div>
              <div className="h-16 flex items-center justify-end">
                <img src="/logo-promuse.png" alt="Logo PROMUSE" className="h-full object-contain" />
              </div>
            </div>
            <div className="border-b-2 border-black pb-1 mb-6">
              <h1 className="font-bold text-sm">Coordenadoria Estadual do Programa Mulher Segura</h1>
            </div>

            <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr>
                <th className="border border-black p-2 text-center uppercase font-bold text-lg" colSpan={2}>EVOLUÇÃO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black w-[30%] p-0 align-top">
                  {/* Empty left column */}
                </td>
                <td className="border border-black w-[70%] p-0">
                  {evolucaoColLines.map((_, i) => (
                    <div key={i} className="border-b border-black h-8 w-full last:border-b-0"></div>
                  ))}
                </td>
              </tr>
              {evolucaoFullLines.map((_, i) => (
                <tr key={i}>
                  <td className="border border-black h-8" colSpan={2}></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* FOOTER PAGE 2 */}
          <div className="text-center mt-auto pt-4">
            <h2 className="text-sm">5º Batalhão de Polícia Militar de Mato Grosso do Sul</h2>
            <p className="text-xs">Av. General Mendes de Moraes, Centro, 190, Coxim – MS</p>
            <p className="text-xs">Fone: (67) 99251-2905 - Mail: promusecoordenacao@gmail.com</p>
          </div>
        </div>

      </div>
    );
  }
);

PrintableFicha.displayName = 'PrintableFicha';
