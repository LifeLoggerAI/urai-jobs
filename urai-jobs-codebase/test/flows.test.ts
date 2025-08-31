
import { resumeAnalysisFlow, salaryPredictionFlow, cultureFitFlow } from '../src/index';
import { inspect } from 'genkit/x/testing';
import { assert } from 'chai';

describe('AI Flows', () => {
  it('should analyze a resume and extract structured data', async () => {
    const resumeText = `
      Jane Doe, Senior Software Engineer
      - 8 years of experience in full-stack development.
      - Expertise in TypeScript, React, Node.js, and Python.
      - Proven ability to lead teams and deliver complex projects on AWS.
      - Passionate about building scalable and user-friendly web applications.
    `;
    const flow = await inspect(resumeAnalysisFlow);
    const result = await flow(resumeText);
    assert.isObject(result, 'Output should be a structured object');
    assert.isString(result.summary, 'Summary must be a string');
    assert.isTrue(result.summary.length > 10, 'Summary should not be empty');
    assert.isArray(result.skills, 'Skills must be an array');
    assert.isTrue(result.skills.length > 0, 'Skills array should not be empty');
    const lowercasedSkills = result.skills.map(s => s.toLowerCase());
    assert.include(lowercasedSkills, 'typescript', 'Should extract TypeScript');
    assert.include(lowercasedSkills, 'react', 'Should extract React');
    assert.include(lowercasedSkills, 'aws', 'Should extract AWS');
    console.log('resumeAnalysisFlow test passed!');
  });

  it('should predict a salary range based on job and candidate data', async () => {
    const input = {
      jobDescription: 'We are hiring a Senior Backend Engineer with expertise in Node.js, microservices, and cloud infrastructure on AWS. The role requires leading a small team and designing scalable systems. 5+ years of experience required.',
      userSkills: ['Node.js', 'AWS', 'TypeScript', 'Team Leadership', 'Microservices'],
      experienceYears: 7,
    };
    const flow = await inspect(salaryPredictionFlow);
    const result = await flow(input);
    assert.isObject(result, 'Output should be a structured object');
    assert.isNumber(result.predictedSalaryMin, 'Min salary must be a number');
    assert.isNumber(result.predictedSalaryMax, 'Max salary must be a number');
    assert.isTrue(result.predictedSalaryMin > 50000, 'Min salary seems too low');
    assert.isTrue(result.predictedSalaryMax > result.predictedSalaryMin, 'Max salary must be greater than min');
    // Note: Currency might vary based on model training, so we check for presence instead of a specific value.
    assert.isString(result.currency, 'Currency must be a string');
    assert.isTrue(result.currency.length > 0, 'Currency should not be empty');
    assert.isString(result.reasoning, 'Reasoning must be a string');
    assert.isTrue(result.reasoning.length > 10, 'Reasoning should not be empty');
    console.log('salaryPredictionFlow test passed!');
  });

  it('should score culture fit between a resume and company description', async () => {
    // 1. Define sample input
    const input = {
      resumeText: 'Led a fast-paced agile team to deliver a new mobile banking app. Thrived in a collaborative environment with daily stand-ups and paired programming. Self-starter, always learning new technologies in my spare time.',
      companyCulture: 'We are a dynamic, fast-growing startup that values collaboration, continuous learning, and individual autonomy. We work in an agile way to innovate quickly. We seek proactive team players who take ownership of their work.',
    };

    // 2. Inspect and run the flow
    const flow = await inspect(cultureFitFlow);
    const result = await flow(input);

    // 3. Assert the output is valid
    assert.isObject(result, 'Output should be a structured object');
    assert.isNumber(result.score, 'Score must be a number');
    assert.isTrue(result.score > 50, 'Score should be high for this good fit');
    assert.isString(result.summary, 'Summary must be a string');
    assert.isTrue(result.summary.length > 10, 'Summary should not be empty');
    assert.isArray(result.matchingAttributes, 'Attributes must be an array');
    assert.isTrue(result.matchingAttributes.length > 0, 'Attributes array should not be empty');
    
    // 4. Check for specific matching attributes
    const lowercasedAttrs = result.matchingAttributes.map(a => a.toLowerCase());
    assert.include(lowercasedAttrs, 'collaboration', 'Should identify collaboration as a match');
    assert.include(lowercasedAttrs, 'continuous learning', 'Should identify learning as a match');

    console.log('cultureFitFlow test passed!');
    console.log(`Culture Fit Score: ${result.score}/100`);
  });
});
