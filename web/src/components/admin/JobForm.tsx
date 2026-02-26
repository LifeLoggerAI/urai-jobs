
import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Job } from '../../../../packages/types/src/jobs';

interface JobFormProps {
  job: Job | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

const JobForm: React.FC<JobFormProps> = ({ job, onSave, onClose }) => {
  const { register, control, handleSubmit, reset } = useForm<Job>({
    defaultValues: job || { requirements: [''], niceToHave: [''] },
  });

  const { fields: reqFields, append: appendReq, remove: removeReq } = useFieldArray({ control, name: 'requirements' });
  const { fields: niceFields, append: appendNice, remove: removeNice } = useFieldArray({ control, name: 'niceToHave' });

  useEffect(() => {
    reset(job || { requirements: [''], niceToHave: [''] });
  }, [job, reset]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{job ? 'Edit Job' : 'Create Job'}</h2>
        <form onSubmit={handleSubmit(onSave)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input {...register('title')} placeholder="Job Title" />
          <input {...register('department')} placeholder="Department" />
          <select {...register('locationType')}>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
          <input {...register('locationText')} placeholder="Location (e.g., San Francisco, CA)" />
          <select {...register('employmentType')}>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
          <textarea {...register('descriptionMarkdown')} placeholder="Job Description (Markdown supported)" rows={6} />

          <div>
            <h3>Requirements</h3>
            {reqFields.map((field, index) => (
              <div key={field.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input {...register(`requirements.${index}`)} placeholder="Requirement" style={{flex: 1}} />
                <button type="button" onClick={() => removeReq(index)}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => appendReq('')}>+ Add Requirement</button>
          </div>

          <div>
            <h3>Nice to Have</h3>
            {niceFields.map((field, index) => (
              <div key={field.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input {...register(`niceToHave.${index}`)} placeholder="Nice to have" style={{flex: 1}}/>
                <button type="button" onClick={() => removeNice(index)}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => appendNice('')}>+ Add Nice-to-Have</button>
          </div>

          <select {...register('status')}>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none' }}>Save Job</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobForm;
