export function getAngleGenerationPrompt(productDescription: string): string {
  return `You are an expert copywriter helping generate marketing angles/ideas for a product.

Product Description:
${productDescription}

Generate 5-7 diverse marketing angles/ideas using these frameworks:

1. 15-Step Framework:
- Explain the product simply
- Choose 2 features and explain benefits
- Target 2 specific groups
- Address fears the product prevents
- Use a superhero angle
- Create "worst ideas" and make them work
- Identify who's responsible for the problem
- Describe life without the product
- Address competitor complaints
- Government/media angle
- Benefit laddering (why does that help me?)
- Personal connections
- News tie-ins
- Scarcity/urgency
- Novelty/BREAKING NEWS

2. 7 Deadly Sins of Dating Ads:
- Apply principles of emotional connection, desire, and transformation

3. Writing Great Leads:
- Offer Lead: Direct deal upfront
- Promise Lead: Big benefit claim
- Problem-Solution Lead: Identify pain, offer solution
- Secret Lead: Intriguing hidden knowledge
- Proclamation Lead: Bold statement
- Story Lead: Narrative engagement

For each angle, provide:
- A compelling headline/angle
- Brief explanation (1-2 sentences)
- Which framework(s) it uses

Format your response as a clear list of angles.`
}

export function getEvaluationPrompt(idea: string, productDescription: string): string {
  return `You are evaluating a marketing angle/idea using the "Big Marketing Idea Formula" checklist.

Product Description:
${productDescription}

Marketing Angle/Idea to Evaluate:
${idea}

Evaluate this idea based on:

1. Emotionally Compelling (EC) = Primary Promise (PP) + Unique Mechanism (UM)
   - PP: Big, bold, audacious promise of transformation
   - PP must be specific, concrete, and backed by proof
   - UM: Unique piece/component/process that delivers the promise

2. Intellectually Interesting (II)
   - Piques curiosity
   - Creates feeling of discovery
   - Feels newsworthy

Provide:
1. Overall Rating: A score from 1-10 (be specific, e.g., 7.5)
2. Primary Promise Assessment: How strong is it? What's missing?
3. Unique Mechanism Assessment: Is there one? How compelling?
4. Intellectually Interesting Assessment: Does it create curiosity?
5. Specific Improvement Feedback: What can be improved and how?

Format as clear, actionable feedback.`
}

export function getPostEvaluationAnglePrompt(
  evaluatedIdeas: string[],
  evaluations: string[],
  productDescription: string
): string {
  return `You are an expert copywriter. Based on the evaluations of previous marketing angles, generate 2 NEW high-potential angles.

Product Description:
${productDescription}

Previous Ideas Evaluated:
${evaluatedIdeas.map((idea, i) => `${i + 1}. ${idea}`).join('\n')}

Evaluation Insights:
${evaluations.map((eval, i) => `Idea ${i + 1}:\n${eval}`).join('\n\n')}

Generate 2 NEW marketing angles that:
- Address the weaknesses identified in previous evaluations
- Build on the strengths that worked
- Are likely to score 8+ on the Big Marketing Idea Formula
- Are fresh and different from the previous angles

For each angle, provide:
- The angle/headline
- Brief explanation of why it should score highly
- Which elements of the formula it addresses

Format as 2 distinct, high-potential angles.`
}
