exports.setDateField=async(page,name,value)=>{
  await page.locator(`#entry-form [name="${name}"]`).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));},value);
};
