//Copy an array and store it another array.
#include<stdio.h>
void main ()
{
    int num2[50],i, n,num1[50], temp;
    printf("How many numbers you want to input = ");
    scanf("%d",&n);
    printf("Enter  %d  numbers  =\n",n);
    for(i=0; i<n; i++)
    {
        printf("num[%d] =",i);
        scanf("%d",&num1[i]);
    }
    printf("--------All the value of array1 = \n");
    for(i=0; i<n; i++)
    {
        printf("%d\t\n",num1[i]);
    }
  for(i=0; i<n; i++)
    {
        num2[i]=num1[i];
    }
    printf("\n---------All the value of array2 =\n ");
    for(i=0; i<n; i++)
    {
    printf("%d\t",num2[i]);
    }


}
