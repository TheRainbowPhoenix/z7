import math

def Add_Leading(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   Leading Character: Char
    #   Desired Length: USInt
    #   String: String
    # VAR_TEMP:
    #   Length: Int
    #   String Box: String
    context['String Box'] = context['String']
    context['Length'] = LEN(context['String Box'])
    while (context['Length'] < context['Desired Length']):
        context['String Box'] = CONCAT_STRING(IN1=context['Leading Character'], IN2=context['String Box'])
        context['Length'] = LEN(context['String Box'])
    context['Add Leading'] = context['String Box']


def Add_Leading_Characters_to_Elements(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   elementLengths: Element Lengths
    #   elementsAsStringArray: String Buffer
    # VAR_OUTPUT:
    #   elementsAsStrings: Elements as Strings
    #   error message: String
    # VAR_TEMP:
    #   ret: Elements as Strings
    _case_val_1 = context['elementLengths'].year
    if _case_val_1 == 0:
        context['ret'].year = ''
    elif _case_val_1 == 2:
        context['ret'].year = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(0)])
    elif _case_val_1 == 4:
        context['ret'].year = CONCAT_STRING(IN1='20', IN2=Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(0)]))
    else:
        context['error message'] = 'invalid year format code'
    _case_val_1 = context['elementLengths'].month
    if _case_val_1 == 0:
        context['ret'].month = ''
    elif _case_val_1 == 1:
        context['ret'].month = context['elementsAsStringArray'].me[int(1)]
    elif _case_val_1 == 2:
        context['ret'].month = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(1)])
    else:
        context['error message'] = 'invalid month format code'
    _case_val_1 = context['elementLengths'].day
    if _case_val_1 == 0:
        context['ret'].day = ''
    elif _case_val_1 == 1:
        context['ret'].day = context['elementsAsStringArray'].me[int(2)]
    elif _case_val_1 == 2:
        context['ret'].day = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(2)])
    else:
        context['error message'] = 'invalid day format code'
    _case_val_1 = context['elementLengths'].hour
    if _case_val_1 == 0:
        context['ret'].hour = ''
    elif _case_val_1 == 1:
        context['ret'].hour = context['elementsAsStringArray'].me[int(3)]
    elif _case_val_1 == 2:
        context['ret'].hour = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(3)])
    else:
        context['error message'] = 'invalid hour format code'
    _case_val_1 = context['elementLengths'].minute
    if _case_val_1 == 0:
        context['ret'].minute = ''
    elif _case_val_1 == 1:
        context['ret'].minute = context['elementsAsStringArray'].me[int(4)]
    elif _case_val_1 == 2:
        context['ret'].minute = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(4)])
    else:
        context['error message'] = 'invalid minute format code'
    _case_val_1 = context['elementLengths'].second
    if _case_val_1 == 0:
        context['ret'].second = ''
    elif _case_val_1 == 1:
        context['ret'].second = context['elementsAsStringArray'].me[int(5)]
    elif _case_val_1 == 2:
        context['ret'].second = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(5)])
    else:
        context['error message'] = 'invalid second format code'
    context['elementsAsStrings'] = context['ret']
