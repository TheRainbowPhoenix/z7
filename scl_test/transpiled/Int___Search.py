import math

def Int___Search(context, global_dbs):
    # Return Type: Int
    # VAR_INPUT:
    #   haystack: Array[*] of Int
    #   needle: Int
    # VAR_TEMP:
    #   size: DInt
    #   i: DInt
    context['REGION']
    context['NOTES']
    context['END_REGION']
    context['REGION']
    global_dbs['GET SIZE']
    context['size'] = UDINT_TO_INT(Int___CountOfElements(context['haystack']))
    context['END_REGION']
    context['REGION']
    context['SEARCH']
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['haystack'][int(context['i'])] == context['needle']):
            context['Int[].Search'] = DINT_TO_INT(context['i'])
            return
    context['END_REGION']
    context['REGION']
    global_dbs['RETURN NOT FOUND']
    context['Int[].Search'] = (-1)
    return
    context['END_REGION']
