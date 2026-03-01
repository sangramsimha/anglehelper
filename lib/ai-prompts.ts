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

For each angle, provide in this exact format:
1. Angle: "Your compelling headline/angle here"
   Explanation: Brief explanation (1-2 sentences)
   Framework: Which framework(s) it uses

Format your response as a numbered list with this structure for each angle.`
}

export function getEvaluationPrompt(idea: string, productDescription: string): string {
  return `You are evaluating a marketing angle/idea using the "Big Marketing Idea Formula" checklist.

Product Description:
${productDescription}

Marketing Angle/Idea to Evaluate:
${idea}

Evaluate this idea based on the Big Marketing Idea Formula:

**Formula: Emotionally Compelling (Primary Promise + Unique Mechanism) + Intellectually Interesting = Big Marketing Idea**

## 1. EMOTIONALLY COMPELLING (EC) = Primary Promise (PP) + Unique Mechanism (UM)

### PRIMARY PROMISE (PP) Assessment:
Evaluate if the idea has a Primary Promise that:
- Tells the prospect what they stand to gain by engaging with the marketing message
- Promises transformation, change, result, or outcome
- Is BIG, BOLD, and AUDACIOUS (not just a product benefit)
- Is SPECIFIC and CONCRETE (not vague or general)
- Is backed by PROOF (can the promise be proven?)
- Is believable (promise should not be bigger than the biggest proof point)
- Uses Magic Wand Technique: If you could grant prospects any transformation, what would they ask for?
- Uses Ideal Client Exercise: What result did the best customer experience?

### UNIQUE MECHANISM (UM) Assessment:
Evaluate if the idea has a Unique Mechanism that:
- Is the unique piece, part, component, aspect, process, or system behind the product
- Delivers the Primary Promise
- Gives prospects hope that THIS time they'll experience the result
- Can be:
  * Actual mechanism (unique algorithm, component, process)
  * Unspoken mechanism (something no one talks about)
  * Transubstantiation mechanism (turning ordinary into extraordinary)

## 2. INTELLECTUALLY INTERESTING (II) Assessment:
Evaluate if the idea:
- Piques the prospect's curiosity
- Gives them a feeling of discovery
- Makes them feel they've stumbled on something newsworthy
- Would interest them even if there was no Primary Promise or Unique Mechanism
- Creates an "AHA moment"
- Feels like breaking news or something worth sharing

## REQUIRED OUTPUT FORMAT:

**Overall Rating:** [Score from 1-10, e.g., 7.5/10]

**Primary Promise Assessment:**
[Detailed evaluation of the Primary Promise - is it big, bold, specific, concrete, backed by proof? What's missing? What could be improved?]

**Unique Mechanism Assessment:**
[Detailed evaluation of the Unique Mechanism - is there one? Is it compelling? Does it deliver the promise? What type is it (actual/unspoken/transubstantiation)? What's missing?]

**Intellectually Interesting Assessment:**
[Detailed evaluation of whether it piques curiosity, creates discovery feeling, feels newsworthy. Does it create an AHA moment? What's missing?]

**Specific Improvement Feedback:**
[Concrete suggestions on how to improve the angle based on all three components. Be specific and actionable.]

Format each section clearly with proper spacing for readability.`
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
${evaluations.map((evaluation, i) => `Idea ${i + 1}:\n${evaluation}`).join('\n\n')}

Generate 3 FINAL marketing angles that:
- Address the weaknesses identified in previous evaluations
- Build on the strengths that worked
- Are likely to score 8+ on the Big Marketing Idea Formula
- Can be either improved versions of previous angles OR completely new angles

For each angle, provide:
- The angle/headline
- Brief explanation of why it should score highly
- Which elements of the formula it addresses

Format as 3 distinct, high-potential angles, clearly numbered.`
}

/** Build system context for continue-chat: product, ideas, and evaluations so the model can reference them. */
export function getContinueChatContext(
  productDescription: string,
  ideas: Array<{ content: string; evaluations: Array<{ overallScore: number | null; notes: string | null }> }>
): string {
  const ideasBlock =
    ideas.length === 0
      ? 'No angles have been generated or evaluated yet.'
      : ideas
          .map((idea, i) => {
            const ev = idea.evaluations[0]
            const score = ev?.overallScore != null ? ` (score: ${ev.overallScore}/10)` : ''
            const notes = ev?.notes ? `\n   Evaluation: ${ev.notes.slice(0, 400)}${ev.notes.length > 400 ? '...' : ''}` : ''
            return `${i + 1}. "${idea.content}"${score}${notes}`
          })
          .join('\n\n')
  return `You are an expert copywriter and marketing strategist helping the user refine their marketing angles. You are continuing a conversation about a product and its marketing angles.

Product description:
${productDescription}

Angles and evaluations so far:
${ideasBlock}

Reference the above product, angles, and evaluations when answering. The user may ask to refine angles, get more ideas, explain evaluations, or discuss strategy. Be concise and actionable.`
}
