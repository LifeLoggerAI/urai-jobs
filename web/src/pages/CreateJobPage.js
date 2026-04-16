import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
export function CreateJobPage() {
    const [tenantId, setTenantId] = useState('default');
    const [orgId, setOrgId] = useState('default');
    const [type, setType] = useState('generic.task');
    const [payload, setPayload] = useState('{}');
    const [jobId, setJobId] = useState('');
    const [output, setOutput] = useState('');
    async function createJob() {
        const call = httpsCallable(functions, 'createJob');
        const result = await call({
            tenantId,
            orgId,
            type,
            origin: 'API',
            priority: 'NORMAL',
            workerClass: 'FUNCTION',
            payload: JSON.parse(payload || '{}')
        });
        const data = result.data;
        setJobId(data.jobId);
        setOutput(JSON.stringify(result.data, null, 2));
    }
    async function getStatus() {
        if (!jobId)
            return;
        const call = httpsCallable(functions, 'getJobStatus');
        const result = await call({ jobId });
        setOutput(JSON.stringify(result.data, null, 2));
    }
    async function cancelJob() {
        if (!jobId)
            return;
        const call = httpsCallable(functions, 'cancelJob');
        const result = await call({ jobId });
        setOutput(JSON.stringify(result.data, null, 2));
    }
    return (_jsxs("div", { children: [_jsx("h1", { children: "URAI-JOBS" }), _jsx("input", { value: tenantId, onChange: (e) => setTenantId(e.target.value), placeholder: "tenantId" }), _jsx("input", { value: orgId, onChange: (e) => setOrgId(e.target.value), placeholder: "orgId" }), _jsx("input", { value: type, onChange: (e) => setType(e.target.value), placeholder: "type" }), _jsx("textarea", { value: payload, onChange: (e) => setPayload(e.target.value), rows: 10, cols: 80 }), _jsxs("div", { children: [_jsx("button", { onClick: createJob, children: "Create job" }), _jsx("button", { onClick: getStatus, children: "Get status" }), _jsx("button", { onClick: cancelJob, children: "Cancel" })] }), _jsx("input", { value: jobId, onChange: (e) => setJobId(e.target.value), placeholder: "jobId" }), _jsx("pre", { children: output })] }));
}
