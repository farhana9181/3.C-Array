//add two matrix
#include<stdio.h>
void main (){
int a[5][5], b[5][5],c[5][5],n,i,m,j;
printf(" How many row =");
scanf("%d",&n);
printf(" How many column =");
scanf("%d",&m);

printf("------Enter elements  first  matrix------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
        printf("a[%d][%d] = ",i,j);
        scanf("%d",&a[i][j]);
    }
}

printf("------Enter elements  second  matrix------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
        printf("a[%d][%d] = ",i,j);
        scanf("%d",&b[i][j]);
    }
}
printf("----matrix 1  are --- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
      printf("%d\t",a[i][j]);
    }
    printf("\n");
}
 printf("----matrix 2 are --- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
      printf("%d\t",b[i][j]);
    }
    printf("\n");
}
 printf("----The summation of this two matrix are = \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
    c[i][j]= (a[i][j]+b[i][j]);
       printf("%d\t ",c[i][j]);
    }
         printf("\n");
}
}




